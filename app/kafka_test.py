import os

from aiokafka import AIOKafkaProducer


KAFKA_BOOTSTRAP_SERVERS = os.getenv(
    "KAFKA_BOOTSTRAP_SERVERS",
    "localhost:9092"
)


async def send_test_message():

    producer = AIOKafkaProducer(
        bootstrap_servers=KAFKA_BOOTSTRAP_SERVERS
    )

    await producer.start()

    try:
        await producer.send_and_wait(
            "capstone-test",
            b"Hello from FastAPI!"
        )

    finally:
        await producer.stop()
