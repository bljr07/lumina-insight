import pika
import json
import os
from supabase import create_client, Client
from dotenv import load_dotenv

# Initialize Supabase client
load_dotenv()

supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_KEY")
print(supabase_url)
print(supabase_key)

if supabase_url and supabase_key:
    supabase: Client = create_client(supabase_url, supabase_key)
else:
    print(" [!] Warning: SUPABASE_URL or SUPABASE_KEY is missing. Data will not be saved.")
    supabase = None

def process_interaction_data(ch, method, properties, body):
    try:
        data = json.loads(body)
        print(f" [x] Received Data: {data.get('event_id', 'Unknown ID')}")
        
        if supabase:
            # Extract fields according to the new schema
            context = data.get('context', {})
            metrics = data.get('metrics', {})
            
            record = {
                'event_id': data.get('event_id'),
                'session_hash': data.get('session_hash'),
                'timestamp': data.get('timestamp'),
                'domain': context.get('domain'),
                'platform_type': context.get('type'),
                'dwell_time_ms': metrics.get('dwell_time_ms', 0),
                'scroll_velocity': metrics.get('scroll_velocity', 0),
                'mouse_jitter': metrics.get('mouse_jitter', 0),
                'tab_switches': metrics.get('tab_switches', 0),
                're_read_cycles': metrics.get('re_read_cycles', 0),
                'inferred_state': data.get('inferred_state', 'UNKNOWN'),
                'transient_content': data.get('transient_content')
            }
            
            # Insert into Supabase
            response = supabase.table('behavioral_events').insert(record).execute()
            print(f" [x] Logged event to Supabase: {response.data}")
                
        # Acknowledge the message
        ch.basic_ack(delivery_tag=method.delivery_tag)
        
    except Exception as e:
        print(f" [!] Error processing message: {e}")
        # Reject message if badly formatted (requeue=False)
        ch.basic_reject(delivery_tag=method.delivery_tag, requeue=False)

def main():
    connection = pika.BlockingConnection(pika.ConnectionParameters(host='localhost'))
    channel = connection.channel()

    # Declare Exchange
    channel.exchange_declare(exchange='lumina.events', exchange_type='direct', durable=True)
    
    # Declare the queue in case it doesn't exist yet
    channel.queue_declare(queue='Lumina_Event', durable=True)
    
    # Bind Queue to Exchange with Routing Key
    channel.queue_bind(exchange='lumina.events', queue='Lumina_Event', routing_key='behavior.packet')

    # Distribute messages fairly avoiding bottlenecks
    channel.basic_qos(prefetch_count=1)
    channel.basic_consume(queue='Lumina_Event', on_message_callback=process_interaction_data)

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
