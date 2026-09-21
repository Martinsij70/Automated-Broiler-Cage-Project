import json
import logging
import queue
import threading
import ssl
import paho.mqtt.client as mqtt
from django.conf import settings
from django.db import close_old_connections
from .services import ingest_ack, ingest_alert, ingest_status, ingest_telemetry

logger = logging.getLogger(__name__)

# class HiveMQSubscriber:
#     def __init__(self):
#         self.client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, protocol=mqtt.MQTTv5)
#         self.client.username_pw_set(settings.MQTT_USERNAME, settings.MQTT_PASSWORD)
#         self.client.tls_set(cert_reqs=ssl.CERT_REQUIRED)
#         self.client.on_connect = self.on_connect
#         self.client.on_message = self.on_message
#         self.client.on_disconnect = self.on_disconnect
#     def on_connect(self, client, userdata, flags, reason_code, properties):
#         if reason_code != 0:
#             logger.error("HiveMQ connection failed: %s", reason_code)
#             return
#         p = settings.MQTT_TOPIC_PREFIX
#         client.subscribe([(f"{p}/telemetry", 1), (f"{p}/status", 1), (f"{p}/availability", 1), (f"{p}/alerts", 1), (f"{p}/ack", 1)])
#         logger.info("Connected to HiveMQ under %s", p)
#     def on_disconnect(self, client, userdata, disconnect_flags, reason_code, properties):
#         if reason_code != 0: logger.warning("Unexpected HiveMQ disconnect: %s", reason_code)
#     def on_message(self, client, userdata, message):
#         close_old_connections()
#         try:
#             payload = json.loads(message.payload.decode("utf-8"))
#             suffix = message.topic.rsplit("/", 1)[-1]
#             {"telemetry": ingest_telemetry, "status": ingest_status, "availability": ingest_status, "alerts": ingest_alert, "ack": ingest_ack}[suffix](payload)
#         except (KeyError, TypeError, ValueError, json.JSONDecodeError):
#             logger.exception("Rejected MQTT message on %s", message.topic)
#         finally:
#             close_old_connections()
#     def run_forever(self):
#         if not all([settings.MQTT_HOST, settings.MQTT_USERNAME, settings.MQTT_PASSWORD]):
#             raise RuntimeError("MQTT_HOST, MQTT_USERNAME and MQTT_PASSWORD are required")
#         self.client.connect(settings.MQTT_HOST, settings.MQTT_PORT, settings.MQTT_KEEPALIVE)
#         self.client.loop_forever(retry_first_connection=True)

class HiveMQSubscriber:
    def __init__(self):
        self.message_queue = queue.Queue(maxsize=1000)

        self.client = mqtt.Client(
            callback_api_version=mqtt.CallbackAPIVersion.VERSION2,
            client_id=settings.MQTT_CLIENT_ID,
            protocol=mqtt.MQTTv5,
            transport="tcp",
        )

        self.client.username_pw_set(
            settings.MQTT_USERNAME,
            settings.MQTT_PASSWORD,
        )

        self.client.tls_set(
            tls_version=ssl.PROTOCOL_TLS_CLIENT,
            cert_reqs=ssl.CERT_REQUIRED,
        )

        self.client.reconnect_delay_set(
            min_delay=1,
            max_delay=30,
        )

        self.client.on_connect = self.on_connect
        self.client.on_message = self.on_message
        self.client.on_disconnect = self.on_disconnect

        self.client.enable_logger(logger)

        self.worker = threading.Thread(
            target=self.process_messages,
            name="mqtt-database-worker",
            daemon=True,
        )

    def on_connect(
        self,
        client,
        userdata,
        flags,
        reason_code,
        properties,
    ):
        if reason_code != 0:
            print(
                f"HiveMQ connection failed: {reason_code}",
                flush=True,
            )
            return

        prefix = settings.MQTT_TOPIC_PREFIX

        subscriptions = [
            (f"{prefix}/telemetry", 1),
            (f"{prefix}/status", 1),
            (f"{prefix}/availability", 1),
            (f"{prefix}/alerts", 1),
            (f"{prefix}/ack", 1),
        ]

        result, message_id = client.subscribe(subscriptions)

        print(
            f"Connected successfully to HiveMQ under {prefix}",
            flush=True,
        )

        print(
            f"Subscription result={result}; "
            f"message_id={message_id}",
            flush=True,
        )

    def on_disconnect(
        self,
        client,
        userdata,
        disconnect_flags,
        reason_code,
        properties,
    ):
        if reason_code != 0:
            logger.warning(
                "Unexpected HiveMQ disconnect: %s",
                reason_code,
            )
        else:
            logger.info("HiveMQ disconnected normally")

    def on_message(
        self,
        client,
        userdata,
        message,
    ):
        try:
            self.message_queue.put_nowait(
                (
                    message.topic,
                    bytes(message.payload),
                )
            )
        except queue.Full:
            logger.error(
                "MQTT processing queue is full; "
                "message rejected on %s",
                message.topic,
            )

    def process_messages(self):
        handlers = {
            "telemetry": ingest_telemetry,
            "status": ingest_status,
            "availability": ingest_status,
            "alerts": ingest_alert,
            "ack": ingest_ack,
        }

        while True:
            topic, raw_payload = self.message_queue.get()
            close_old_connections()

            try:
                payload = json.loads(
                    raw_payload.decode("utf-8")
                )

                suffix = topic.rsplit("/", 1)[-1]
                handler = handlers[suffix]
                handler(payload)

            except (
                KeyError,
                TypeError,
                ValueError,
                json.JSONDecodeError,
            ):
                logger.exception(
                    "Rejected MQTT message on %s",
                    topic,
                )

            except Exception:
                logger.exception(
                    "Failed to process MQTT message on %s",
                    topic,
                )

            finally:
                close_old_connections()
                self.message_queue.task_done()

    def run_forever(self):
        required_settings = [
            settings.MQTT_HOST,
            settings.MQTT_USERNAME,
            settings.MQTT_PASSWORD,
        ]

        if not all(required_settings):
            raise RuntimeError(
                "MQTT_HOST, MQTT_USERNAME and "
                "MQTT_PASSWORD are required"
            )

        if not self.worker.is_alive():
            self.worker.start()

        logger.info(
            "Connecting to HiveMQ host=%s port=%s "
            "client_id=%s keepalive=%s",
            settings.MQTT_HOST,
            settings.MQTT_PORT,
            settings.MQTT_CLIENT_ID,
            settings.MQTT_KEEPALIVE,
        )

        self.client.connect(
            host=settings.MQTT_HOST,
            port=settings.MQTT_PORT,
            keepalive=settings.MQTT_KEEPALIVE,
        )

        self.client.loop_forever(
            timeout=1.0,
            retry_first_connection=True,
        )