import pika
import json
import os
from flask import Flask
from models import db, HeatmapPoint, GhostData

# Set up mock Flask App Context to access DB
app = Flask(__name__)
basedir = os.path.abspath(os.path.dirname(__file__))
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///' + os.path.join(basedir, 'app.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db.init_app(app)

def process_interaction_data(ch, method, properties, body):
    try:
        data = json.loads(body)
        print(f" [x] Received Data: {data}")
        
        # Example of writing processed data. 
        # Depending on the payload from the extension (e.g. `type: "stalled"`), we adapt the logic.
        # For now, we will just echo it or log it into a general Stat/Heatmap table as MVP.
        
        with app.app_context():
            # Mock Logic for MVP: increment heatmap intensity if the user "stalled"
            if data.get('event_type') == 'interaction_stall':
                # Simplified date to week/day logic mapped from payload
                week = data.get('week', 0)
                day = data.get('day', 0)
                
                # Check for existing point
                point = HeatmapPoint.query.filter_by(week=week, day=day).first()
                if point:
                    point.intensity += 1
                else:
                    new_point = HeatmapPoint(week=week, day=day, intensity=1)
                    db.session.add(new_point)
                    
                db.session.commit()
                print(" [x] Logged stall interaction to DB.")
                
        # Acknowledge the message
        ch.basic_ack(delivery_tag=method.delivery_tag)
        
    except Exception as e:
        print(f" [!] Error processing message: {e}")
        # Reject message if badly formatted (requeue=False)
        ch.basic_reject(delivery_tag=method.delivery_tag, requeue=False)

def main():
    connection = pika.BlockingConnection(pika.ConnectionParameters(host='localhost'))
    channel = connection.channel()

    # Declare the queue in case it doesn't exist yet
    channel.queue_declare(queue='lumina_data_queue', durable=True)

    # Distribute messages fairly avoiding bottlenecks
    channel.basic_qos(prefetch_count=1)
    channel.basic_consume(queue='lumina_data_queue', on_message_callback=process_interaction_data)

    print(' [*] Waiting for messages. To exit press CTRL+C')
    channel.start_consuming()

if __name__ == '__main__':
    # Initialize DB (Optional, run once if DB is empty)
    # with app.app_context():
    #     db.create_all()
    
    try:
        main()
    except KeyboardInterrupt:
        print('Interrupted')
        try:
            import sys
            sys.exit(0)
        except SystemExit:
            os._exit(0)
