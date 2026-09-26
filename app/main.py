from fastapi import FastAPI
from sqlalchemy import text

from app.database import engine
from app.kafka_test import send_test_message

app = FastAPI()


@app.get("/")
def home():
    return { 
	"message": "Incident Reporting app is running"
    }


@app.get("/db-test")
def database_test():
    with engine.connect() as connection:
        result = connection.execute(
            text("SELECT current_database()")
        )

        return {
            "status": "connected",
            "database": result.scalar()
        }

@app.post("/kafka-test")
async def kafka_test():
    try:
        await send_test_message()

        return {
            "success": True,
            "message": "Message sent to Kafka"
        }

    except Exception as e:
        return {
            "success": False,
            "error_type": type(e).__name__,
            "error": str(e)
        }
