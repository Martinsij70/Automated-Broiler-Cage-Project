import csv
from django.contrib.auth import authenticate, get_user_model, login, logout
from django.db.models import Avg, OuterRef, Q, Subquery
from django.db.models.functions import TruncDate
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.views.decorators.csrf import ensure_csrf_cookie
from django.utils.decorators import method_decorator
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from .models import Alert, ActuatorCommand, Cage, Device, Farm, FlockBatch, SecurityEvent, TelemetryReading, ThresholdConfiguration, Tier
from .serializers import AlertSerializer, CommandCreateSerializer, FlockBatchSerializer, SecurityEventSerializer, TelemetryReadingSerializer, ThresholdSerializer
from .services import publish_command

def get_cage(farm_id, cage_id):
    return get_object_or_404(Cage.objects.select_related("farm"), farm__external_id=farm_id, external_id=cage_id)

def get_managed_cage(request, farm_id, cage_id):
    return get_object_or_404(Cage.objects.select_related("farm"), farm__owner=request.user, farm__external_id=farm_id, external_id=cage_id)

def user_payload(user):
    return {"id": user.id, "username": user.username, "email": user.email}

@method_decorator(ensure_csrf_cookie, name="dispatch")
class AuthCsrfView(APIView):
    permission_classes = [permissions.AllowAny]
    def get(self, request): return Response({"detail": "CSRF cookie set"})

class AuthRegisterView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    def post(self, request):
        username = str(request.data.get("username", "")).strip()
        email = str(request.data.get("email", "")).strip()
        password = str(request.data.get("password", ""))
        if len(username) < 3 or len(password) < 8:
            return Response({"detail": "Username must have at least 3 characters and password at least 8."}, status=status.HTTP_400_BAD_REQUEST)
        if get_user_model().objects.filter(username__iexact=username).exists():
            return Response({"detail": "Username is already registered."}, status=status.HTTP_400_BAD_REQUEST)
        user = get_user_model().objects.create_user(username=username, email=email, password=password)
        login(request, user)
        return Response(user_payload(user), status=status.HTTP_201_CREATED)

class AuthLoginView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    def post(self, request):
        user = authenticate(request, username=request.data.get("username"), password=request.data.get("password"))
        if user is None:
            return Response({"detail": "Invalid username or password."}, status=status.HTTP_400_BAD_REQUEST)
        login(request, user)
        return Response(user_payload(user))

class AuthLogoutView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def post(self, request):
        logout(request)
        return Response(status=status.HTTP_204_NO_CONTENT)

class AuthMeView(APIView):
    permission_classes = [permissions.AllowAny]
    def get(self, request):
        return Response(user_payload(request.user) if request.user.is_authenticated else None)

class FarmCageSetupView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def get(self, request):
        cages = Cage.objects.filter(Q(farm__owner=request.user) | Q(farm__owner__isnull=True)).select_related("farm").order_by("farm__external_id", "external_id")
        return Response([{"farm_id": cage.farm.external_id, "farm_name": cage.farm.name, "cage_id": cage.external_id, "cage_name": cage.name} for cage in cages])
    def post(self, request):
        farm_id = str(request.data.get("farm_id", "")).strip()
        cage_id = str(request.data.get("cage_id", "")).strip()
        if not farm_id or not cage_id:
            return Response({"detail": "farm_id and cage_id are required."}, status=status.HTTP_400_BAD_REQUEST)
        farm, _ = Farm.objects.get_or_create(external_id=farm_id, defaults={"name": request.data.get("farm_name") or farm_id, "owner": request.user})
        if farm.owner not in {None, request.user}:
            return Response({"detail": "This farm identifier belongs to another account."}, status=status.HTTP_403_FORBIDDEN)
        if farm.owner is None:
            farm.owner = request.user
            farm.save(update_fields=["owner"])
        cage, _ = Cage.objects.get_or_create(farm=farm, external_id=cage_id, defaults={"name": request.data.get("cage_name") or cage_id})
        Device.objects.get_or_create(cage=cage, defaults={"device_id": f"{farm_id}-{cage_id}"})
        ThresholdConfiguration.objects.get_or_create(cage=cage)
        for number in range(1, 5): Tier.objects.get_or_create(cage=cage, number=number, defaults={"name": f"Tier {number}"})
        return Response({"farm_id": farm.external_id, "farm_name": farm.name, "cage_id": cage.external_id, "cage_name": cage.name}, status=status.HTTP_201_CREATED)

class LatestTelemetryView(APIView):
    permission_classes = [permissions.AllowAny]
    def get(self, request, farm_id, cage_id):
        cage = get_cage(farm_id, cage_id)
        latest = TelemetryReading.objects.filter(cage=cage, tier=OuterRef("tier")).order_by("-sampled_at").values("id")[:1]
        rows = TelemetryReading.objects.filter(id__in=Subquery(latest)).select_related("cage__farm", "tier").order_by("tier__number")
        return Response(TelemetryReadingSerializer(rows, many=True).data)

class TelemetryHistoryView(generics.ListAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = TelemetryReadingSerializer
    def get_queryset(self):
        qs = TelemetryReading.objects.filter(cage=get_cage(self.kwargs["farm_id"], self.kwargs["cage_id"])).select_related("cage__farm", "tier")
        if self.request.query_params.get("tier"): qs = qs.filter(tier__number=self.request.query_params["tier"])
        if self.request.query_params.get("since"): qs = qs.filter(sampled_at__gte=self.request.query_params["since"])
        return qs.order_by("-sampled_at")

class AlertListView(generics.ListAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = AlertSerializer
    def get_queryset(self): return Alert.objects.filter(cage=get_cage(self.kwargs["farm_id"], self.kwargs["cage_id"])).select_related("tier")

class AlertAcknowledgeView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def post(self, request, farm_id, cage_id, alert_id):
        alert = get_object_or_404(Alert, id=alert_id, cage=get_managed_cage(request, farm_id, cage_id))
        if alert.acknowledged_at is None:
            alert.acknowledged_at = timezone.now()
            alert.save(update_fields=["acknowledged_at"])
        return Response(AlertSerializer(alert).data)

class SecurityEventListView(generics.ListAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = SecurityEventSerializer
    def get_queryset(self): return SecurityEvent.objects.filter(cage=get_cage(self.kwargs["farm_id"], self.kwargs["cage_id"])).select_related("tier")

class DeviceStatusView(APIView):
    permission_classes = [permissions.AllowAny]
    def get(self, request, farm_id, cage_id):
        device = get_object_or_404(Device, cage=get_cage(farm_id, cage_id))
        state = Device.State.STALE if device.last_seen_at and (timezone.now() - device.last_seen_at).total_seconds() > 90 else device.state
        return Response({"device_id": device.device_id, "state": state, "last_seen_at": device.last_seen_at})

class ThresholdView(APIView):
    def get_permissions(self): return [permissions.AllowAny()] if self.request.method == "GET" else [permissions.IsAuthenticated()]
    def get(self, request, farm_id, cage_id):
        config, _ = ThresholdConfiguration.objects.get_or_create(cage=get_cage(farm_id, cage_id))
        return Response(ThresholdSerializer(config).data)
    def patch(self, request, farm_id, cage_id):
        config, _ = ThresholdConfiguration.objects.get_or_create(cage=get_managed_cage(request, farm_id, cage_id))
        serializer = ThresholdSerializer(config, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

class CommandCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def post(self, request, farm_id, cage_id):
        cage = get_managed_cage(request, farm_id, cage_id)
        serializer = CommandCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        tier = get_object_or_404(Tier, cage=cage, number=serializer.validated_data.pop("tier"))
        command = ActuatorCommand.objects.create(cage=cage, tier=tier, requested_by=request.user, **serializer.validated_data)
        try: payload = publish_command(command)
        except Exception as exc:
            command.status = ActuatorCommand.Status.FAILED
            command.save(update_fields=["status"])
            return Response({"command_id": command.command_id, "status": command.status, "detail": str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        return Response({"command_id": command.command_id, "status": command.status, "payload": payload}, status=status.HTTP_201_CREATED)

class ActiveBatchView(APIView):
    def get_permissions(self): return [permissions.AllowAny()] if self.request.method == "GET" else [permissions.IsAuthenticated()]
    def get(self, request, farm_id, cage_id):
        return Response(FlockBatchSerializer(get_object_or_404(FlockBatch, cage=get_cage(farm_id, cage_id), active=True)).data)
    def post(self, request, farm_id, cage_id):
        cage = get_managed_cage(request, farm_id, cage_id)
        FlockBatch.objects.filter(cage=cage, active=True).update(active=False)
        serializer = FlockBatchSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        batch = serializer.save(cage=cage, active=True)
        return Response(FlockBatchSerializer(batch).data, status=status.HTTP_201_CREATED)
    def patch(self, request, farm_id, cage_id):
        batch = get_object_or_404(FlockBatch, cage=get_managed_cage(request, farm_id, cage_id), active=True)
        serializer = FlockBatchSerializer(batch, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

class TelemetryExportView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def get(self, request, farm_id, cage_id):
        rows = TelemetryReading.objects.filter(cage=get_managed_cage(request, farm_id, cage_id)).select_related("tier").order_by("sampled_at")
        response = HttpResponse(content_type="text/csv")
        response["Content-Disposition"] = f'attachment; filename="{farm_id}-{cage_id}-telemetry.csv"'
        writer = csv.writer(response)
        writer.writerow(["sampled_at", "tier", "temperature_c", "humidity_rh", "light_lux", "ammonia_ppm", "co2_ppm", "weight_kg", "source"])
        for row in rows:
            writer.writerow([row.sampled_at.isoformat(), row.tier.number, row.temperature_c, row.humidity_rh, row.light_lux, row.ammonia_ppm, row.co2_ppm, row.weight_kg, row.source])
        return response

class WeightDailyView(APIView):
    permission_classes = [permissions.AllowAny]
    def get(self, request, farm_id, cage_id):
        rows = (TelemetryReading.objects.filter(cage=get_cage(farm_id, cage_id), weight_kg__isnull=False)
                .annotate(day=TruncDate("sampled_at")).values("day", "tier__number").annotate(average_weight_kg=Avg("weight_kg")).order_by("day", "tier__number"))
        previous = {}
        result = []
        for row in rows:
            tier = row["tier__number"]
            weight = round(row["average_weight_kg"], 3)
            increase = None if tier not in previous else round(weight - previous[tier], 3)
            result.append({"date": row["day"], "tier": tier, "average_weight_kg": weight, "daily_increase_kg": increase})
            previous[tier] = weight
        return Response(result)
