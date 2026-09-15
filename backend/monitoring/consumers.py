from channels.generic.websocket import AsyncJsonWebsocketConsumer

class CageConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        self.group_name = f"cage_{self.scope['url_route']['kwargs']['farm_id']}_{self.scope['url_route']['kwargs']['cage_id']}"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()
    async def disconnect(self, close_code): await self.channel_layer.group_discard(self.group_name, self.channel_name)
    async def cage_event(self, event): await self.send_json({"event": event["event"], "data": event["data"]})
