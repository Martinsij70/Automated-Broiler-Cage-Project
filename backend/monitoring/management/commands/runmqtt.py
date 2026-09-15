from django.core.management.base import BaseCommand
from monitoring.mqtt import HiveMQSubscriber
class Command(BaseCommand):
    help = "Run the dedicated HiveMQ telemetry subscriber."
    def handle(self, *args, **options):
        self.stdout.write("Starting HiveMQ subscriber...")
        HiveMQSubscriber().run_forever()
