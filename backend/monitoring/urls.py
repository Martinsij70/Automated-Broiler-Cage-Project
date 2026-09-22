from django.urls import path
from .views import ActiveBatchView, AlertAcknowledgeView, AlertListView, AuthCsrfView, AuthLoginView, AuthLogoutView, AuthMeView, AuthRegisterView, CommandCreateView, DeviceStatusView, FarmCageSetupView, LatestTelemetryView, SecurityEventListView, TelemetryExportView, TelemetryHistoryView, ThresholdView, WeightDailyView

urlpatterns = [
    path("auth/csrf/", AuthCsrfView.as_view(), name="auth-csrf"),
    path("auth/register/", AuthRegisterView.as_view(), name="auth-register"),
    path("auth/login/", AuthLoginView.as_view(), name="auth-login"),
    path("auth/logout/", AuthLogoutView.as_view(), name="auth-logout"),
    path("auth/me/", AuthMeView.as_view(), name="auth-me"),
    path("setup/cages/", FarmCageSetupView.as_view(), name="farm-cage-setup"),
    path("farms/<slug:farm_id>/cages/<slug:cage_id>/telemetry/latest/", LatestTelemetryView.as_view(), name="latest-telemetry"),
    path("farms/<slug:farm_id>/cages/<slug:cage_id>/telemetry/history/", TelemetryHistoryView.as_view(), name="telemetry-history"),
    path("farms/<slug:farm_id>/cages/<slug:cage_id>/telemetry/export.csv", TelemetryExportView.as_view(), name="telemetry-export"),
    path("farms/<slug:farm_id>/cages/<slug:cage_id>/weight/daily/", WeightDailyView.as_view(), name="weight-daily"),
    path("farms/<slug:farm_id>/cages/<slug:cage_id>/alerts/", AlertListView.as_view(), name="alerts"),
    path("farms/<slug:farm_id>/cages/<slug:cage_id>/alerts/<int:alert_id>/acknowledge/", AlertAcknowledgeView.as_view(), name="alert-acknowledge"),
    path("farms/<slug:farm_id>/cages/<slug:cage_id>/security-events/", SecurityEventListView.as_view(), name="security-events"),
    path("farms/<slug:farm_id>/cages/<slug:cage_id>/status/", DeviceStatusView.as_view(), name="device-status"),
    path("farms/<slug:farm_id>/cages/<slug:cage_id>/thresholds/", ThresholdView.as_view(), name="thresholds"),
    path("farms/<slug:farm_id>/cages/<slug:cage_id>/commands/", CommandCreateView.as_view(), name="commands"),
    path("farms/<slug:farm_id>/cages/<slug:cage_id>/batch/active/", ActiveBatchView.as_view(), name="active-batch"),
]
