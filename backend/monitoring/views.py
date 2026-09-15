from django.db.models import OuterRef, Subquery
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from .models import Alert, ActuatorCommand, Cage, Device, FlockBatch, SecurityEvent, TelemetryReading, ThresholdConfiguration, Tier
from .serializers import AlertSerializer, CommandCreateSerializer, FlockBatchSerializer, SecurityEventSerializer, TelemetryReadingSerializer, ThresholdSerializer
from .services import publish_command

def get_cage(farm_id, cage_id):
    return get_object_or_404(Cage.objects.select_related("farm"), farm__external_id=farm_id, external_id=cage_id)

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
        config, _ = ThresholdConfiguration.objects.get_or_create(cage=get_cage(farm_id, cage_id))
        serializer = ThresholdSerializer(config, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

class CommandCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def post(self, request, farm_id, cage_id):
        cage = get_cage(farm_id, cage_id)
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
    permission_classes = [permissions.AllowAny]
    def get(self, request, farm_id, cage_id):
        return Response(FlockBatchSerializer(get_object_or_404(FlockBatch, cage=get_cage(farm_id, cage_id), active=True)).data)
