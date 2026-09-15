from django.urls import path
from .views import ActiveBatchView, AlertListView, CommandCreateView, DeviceStatusView, LatestTelemetryView, SecurityEventListView, TelemetryHistoryView, ThresholdView

urlpatterns = [
    path("farms/<slug:farm_id>/cages/<slug:cage_id>/telemetry/latest/", LatestTelemetryView.as_view(), name="latest-telemetry"),
    path("farms/<slug:farm_id>/cages/<slug:cage_id>/telemetry/history/", TelemetryHistoryView.as_view(), name="telemetry-history"),
    path("farms/<slug:farm_id>/cages/<slug:cage_id>/alerts/", AlertListView.as_view(), name="alerts"),
    path("farms/<slug:farm_id>/cages/<slug:cage_id>/security-events/", SecurityEventListView.as_view(), name="security-events"),
    path("farms/<slug:farm_id>/cages/<slug:cage_id>/status/", DeviceStatusView.as_view(), name="device-status"),
    path("farms/<slug:farm_id>/cages/<slug:cage_id>/thresholds/", ThresholdView.as_view(), name="thresholds"),
    path("farms/<slug:farm_id>/cages/<slug:cage_id>/commands/", CommandCreateView.as_view(), name="commands"),
    path("farms/<slug:farm_id>/cages/<slug:cage_id>/batch/active/", ActiveBatchView.as_view(), name="active-batch"),
]
