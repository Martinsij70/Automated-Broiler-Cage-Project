import uuid
from django.conf import settings
from django.db import models
from django.utils import timezone

class Farm(models.Model):
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, related_name="farms", on_delete=models.SET_NULL)
    external_id = models.SlugField(max_length=64, unique=True)
    name = models.CharField(max_length=160)
    created_at = models.DateTimeField(auto_now_add=True)
    def __str__(self): return self.name

class Cage(models.Model):
    farm = models.ForeignKey(Farm, related_name="cages", on_delete=models.CASCADE)
    external_id = models.SlugField(max_length=64)
    name = models.CharField(max_length=160)
    class Meta:
        constraints = [models.UniqueConstraint(fields=["farm", "external_id"], name="unique_cage_per_farm")]
    def __str__(self): return f"{self.farm.external_id}/{self.external_id}"

class Tier(models.Model):
    cage = models.ForeignKey(Cage, related_name="tiers", on_delete=models.CASCADE)
    number = models.PositiveSmallIntegerField()
    name = models.CharField(max_length=80, blank=True)
    class Meta:
        ordering = ["number"]
        constraints = [models.UniqueConstraint(fields=["cage", "number"], name="unique_tier_per_cage")]
    def __str__(self): return f"{self.cage} tier {self.number}"

class Device(models.Model):
    class State(models.TextChoices):
        ONLINE = "online", "Online"
        STALE = "stale", "Stale"
        OFFLINE = "offline", "Offline"
    cage = models.OneToOneField(Cage, related_name="device", on_delete=models.CASCADE)
    device_id = models.SlugField(max_length=100, unique=True)
    state = models.CharField(max_length=12, choices=State.choices, default=State.OFFLINE)
    last_seen_at = models.DateTimeField(null=True, blank=True)
    metadata = models.JSONField(default=dict, blank=True)

class FlockBatch(models.Model):
    cage = models.ForeignKey(Cage, related_name="batches", on_delete=models.CASCADE)
    batch_id = models.SlugField(max_length=100, unique=True)
    started_at = models.DateField()
    bird_count = models.PositiveIntegerField()
    initial_total_weight_kg = models.DecimalField(max_digits=10, decimal_places=3, default=0)
    current_total_weight_kg = models.DecimalField(max_digits=10, decimal_places=3, default=0)
    feed_consumed_kg = models.DecimalField(max_digits=10, decimal_places=3, default=0)
    active = models.BooleanField(default=True)
    @property
    def weight_gained_kg(self): return max(self.current_total_weight_kg - self.initial_total_weight_kg, 0)
    @property
    def fcr(self): return round(self.feed_consumed_kg / self.weight_gained_kg, 3) if self.weight_gained_kg else None

class TelemetryReading(models.Model):
    class Source(models.TextChoices):
        HARDWARE = "hardware", "Hardware"
        SIMULATOR = "simulator", "Simulator"
    cage = models.ForeignKey(Cage, related_name="telemetry", on_delete=models.CASCADE)
    tier = models.ForeignKey(Tier, related_name="telemetry", on_delete=models.CASCADE)
    sampled_at = models.DateTimeField()
    received_at = models.DateTimeField(auto_now_add=True)
    source = models.CharField(max_length=12, choices=Source.choices, default=Source.HARDWARE)
    temperature_c = models.FloatField(null=True, blank=True)
    humidity_rh = models.FloatField(null=True, blank=True)
    light_lux = models.FloatField(null=True, blank=True)
    ammonia_ppm = models.FloatField(null=True, blank=True)
    co2_ppm = models.FloatField(null=True, blank=True)
    weight_kg = models.FloatField(null=True, blank=True)
    actuators = models.JSONField(default=dict)
    field_quality = models.JSONField(default=dict, blank=True)
    raw_payload = models.JSONField(default=dict, blank=True)
    class Meta:
        ordering = ["-sampled_at"]
        indexes = [models.Index(fields=["cage", "tier", "-sampled_at"])]

class ThresholdConfiguration(models.Model):
    cage = models.OneToOneField(Cage, related_name="thresholds", on_delete=models.CASCADE)
    temperature_low_c = models.FloatField(default=20)
    temperature_high_c = models.FloatField(default=32)
    humidity_low_rh = models.FloatField(default=40)
    humidity_high_rh = models.FloatField(default=80)
    ammonia_high_ppm = models.FloatField(default=25)
    co2_high_ppm = models.FloatField(default=3000)
    buzzer_hold_seconds = models.PositiveIntegerField(default=10)
    updated_at = models.DateTimeField(auto_now=True)

class Alert(models.Model):
    class Severity(models.TextChoices):
        WARNING = "warning", "Warning"
        CRITICAL = "critical", "Critical"
    cage = models.ForeignKey(Cage, related_name="alerts", on_delete=models.CASCADE)
    tier = models.ForeignKey(Tier, null=True, blank=True, related_name="alerts", on_delete=models.SET_NULL)
    code = models.SlugField(max_length=80)
    title = models.CharField(max_length=180)
    detail = models.TextField(blank=True)
    severity = models.CharField(max_length=10, choices=Severity.choices)
    opened_at = models.DateTimeField(default=timezone.now)
    acknowledged_at = models.DateTimeField(null=True, blank=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    payload = models.JSONField(default=dict, blank=True)
    class Meta: ordering = ["-opened_at"]

class SecurityEvent(models.Model):
    cage = models.ForeignKey(Cage, related_name="security_events", on_delete=models.CASCADE)
    tier = models.ForeignKey(Tier, null=True, blank=True, related_name="security_events", on_delete=models.SET_NULL)
    detected_at = models.DateTimeField()
    received_at = models.DateTimeField(auto_now_add=True)
    source = models.CharField(max_length=20, default="pir")
    buzzer_activated = models.BooleanField(default=True)
    payload = models.JSONField(default=dict, blank=True)
    class Meta: ordering = ["-detected_at"]

class ActuatorCommand(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        PUBLISHED = "published", "Published"
        EXECUTED = "executed", "Executed"
        REJECTED = "rejected", "Rejected"
        FAILED = "failed", "Failed"
    command_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    cage = models.ForeignKey(Cage, related_name="commands", on_delete=models.CASCADE)
    tier = models.ForeignKey(Tier, related_name="commands", on_delete=models.CASCADE)
    target = models.CharField(max_length=30)
    value = models.BooleanField()
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.PENDING)
    requested_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    requested_at = models.DateTimeField(auto_now_add=True)
    published_at = models.DateTimeField(null=True, blank=True)
    acknowledged_at = models.DateTimeField(null=True, blank=True)
    acknowledgement = models.JSONField(default=dict, blank=True)
    class Meta: ordering = ["-requested_at"]
