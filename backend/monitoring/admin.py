from django.contrib import admin
from .models import Alert, ActuatorCommand, Cage, Device, Farm, FlockBatch, SecurityEvent, TelemetryReading, ThresholdConfiguration, Tier
admin.site.register([Farm, Cage, Tier, Device, FlockBatch, TelemetryReading, ThresholdConfiguration, Alert, SecurityEvent, ActuatorCommand])
