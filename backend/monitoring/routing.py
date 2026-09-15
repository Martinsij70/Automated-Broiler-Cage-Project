from django.urls import path
from .consumers import CageConsumer
websocket_urlpatterns = [path("ws/farms/<slug:farm_id>/cages/<slug:cage_id>/", CageConsumer.as_asgi())]
