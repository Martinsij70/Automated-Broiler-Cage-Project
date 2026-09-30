from rest_framework import serializers
from .models import Alert, ActuatorCommand, FlockBatch, SecurityEvent, TelemetryReading, ThresholdConfiguration

class TelemetryReadingSerializer(serializers.ModelSerializer):
    farm_id = serializers.CharField(source="cage.farm.external_id", read_only=True)
    cage_id = serializers.CharField(source="cage.external_id", read_only=True)
    tier = serializers.IntegerField(source="tier.number", read_only=True)
    sensors = serializers.SerializerMethodField()
    class Meta:
        model = TelemetryReading
        fields = ["id", "farm_id", "cage_id", "tier", "sampled_at", "received_at", "source", "sensors", "actuators", "field_quality"]
    def get_sensors(self, obj):
        return {"temperature": obj.temperature_c, "humidity": obj.humidity_rh, "lux": obj.light_lux, "ammonia_ppm": obj.ammonia_ppm, "co2_ppm": obj.co2_ppm, "weight_kg": obj.weight_kg}

class AlertSerializer(serializers.ModelSerializer):
    tier = serializers.IntegerField(source="tier.number", allow_null=True, read_only=True)
    class Meta:
        model = Alert
        fields = "__all__"

class SecurityEventSerializer(serializers.ModelSerializer):
    tier = serializers.IntegerField(source="tier.number", allow_null=True, read_only=True)
    class Meta:
        model = SecurityEvent
        fields = "__all__"

class ThresholdSerializer(serializers.ModelSerializer):
    class Meta:
        model = ThresholdConfiguration
        exclude = ["id", "cage"]
    def validate(self, attrs):
        low_t = attrs.get("temperature_low_c", getattr(self.instance, "temperature_low_c", 20))
        high_t = attrs.get("temperature_high_c", getattr(self.instance, "temperature_high_c", 32))
        low_h = attrs.get("humidity_low_rh", getattr(self.instance, "humidity_low_rh", 40))
        high_h = attrs.get("humidity_high_rh", getattr(self.instance, "humidity_high_rh", 80))
        if low_t >= high_t or low_h >= high_h:
            raise serializers.ValidationError("Each low threshold must be below its high threshold.")
        return attrs

class CommandCreateSerializer(serializers.ModelSerializer):
    tier = serializers.IntegerField(write_only=True)
    class Meta:
        model = ActuatorCommand
        fields = ["command_id", "tier", "target", "value", "status", "requested_at"]
        read_only_fields = ["command_id", "status", "requested_at"]
    def validate_target(self, value):
        allowed = {"led", "fan", "solenoid_valve", "heater", "buzzer"}
        if value not in allowed:
            raise serializers.ValidationError(f"Target must be one of: {', '.join(sorted(allowed))}.")
        return value

class FlockBatchSerializer(serializers.ModelSerializer):
    weight_gained_kg = serializers.DecimalField(max_digits=10, decimal_places=3, read_only=True)
    fcr = serializers.FloatField(read_only=True)
    class Meta:
        model = FlockBatch
        fields = ["batch_id", "started_at", "bird_count", "initial_total_weight_kg", "current_total_weight_kg", "feed_consumed_kg", "weight_gained_kg", "fcr", "active"]

    def validate_bird_count(self, value):
        if value < 1:
            raise serializers.ValidationError("Bird count must be at least 1.")
        return value
