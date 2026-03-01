from flask import Flask, jsonify, request
from flask_cors import CORS
from models import db, Stat, KnowledgeNode, KnowledgeEdge, HeatmapPoint, Skill, GhostData, TimelinePoint, Nudge, FederatedWeight, GlobalModel
import os

app = Flask(__name__)
CORS(app)

# Use absolute path for SQLite database
basedir = os.path.abspath(os.path.dirname(__file__))
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///' + os.path.join(basedir, 'app.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db.init_app(app)

import pika
import json

# Initialize RabbitMQ Connection (assuming defaults: localhost:5672)
# We instantiate this lazily or per-request in a production app, but for MVP we'll use a basic function
def get_rabbitmq_channel():
    connection = pika.BlockingConnection(pika.ConnectionParameters('localhost'))
    channel = connection.channel()
    channel.queue_declare(queue='lumina_data_queue', durable=True)
    return connection, channel

@app.route('/api/ingest', methods=['POST'])
def ingest_data():
    try:
        data = request.json
        if not data:
            return jsonify({'error': 'No JSON payload provided'}), 400
        
        # Publish to RabbitMQ
        connection, channel = get_rabbitmq_channel()
        channel.basic_publish(
            exchange='',
            routing_key='lumina_data_queue',
            body=json.dumps(data),
            properties=pika.BasicProperties(
                delivery_mode=pika.spec.PERSISTENT_DELIVERY_MODE
            )
        )
        connection.close()
        
        return jsonify({'status': 'queued'}), 202
    except Exception as e:
        app.logger.error(f"Ingestion Error: {e}")
        return jsonify({'error': str(e)}), 500

# ─── Federated Learning Sync Loop ────────────────────────────────────────────────

FEDERATED_AGGREGATION_THRESHOLD = 3

@app.route('/api/federated/push', methods=['POST'])
def federated_push():
    """
    Receives local model weights from clients.
    Triggers an aggregation cycle if enough unprocessed weights are collected.
    """
    try:
        data = request.json
        if not data or 'client_id' not in data or 'weights' not in data:
            return jsonify({'error': 'Missing client_id or weights'}), 400

        # Save to DB
        fw = FederatedWeight(
            client_id=data['client_id'],
            weights=json.dumps(data['weights'])
        )
        db.session.add(fw)
        db.session.commit()

        # Check if we should run an aggregation cycle
        unprocessed_count = FederatedWeight.query.filter_by(processed=False).count()
        if unprocessed_count >= FEDERATED_AGGREGATION_THRESHOLD:
            _aggregate_federated_weights()

        return jsonify({'status': 'Weights received successfully'}), 200
    except Exception as e:
        app.logger.error(f"Federated Push Error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/federated/pull', methods=['GET'])
def federated_pull():
    """Returns the latest GlobalModel version and weights."""
    try:
        latest_model = GlobalModel.query.order_by(GlobalModel.version.desc()).first()
        if not latest_model:
            # If no model exists, return a dummy representation for the MVP clients
            # (In reality, this would be an ONNX byte array or initial floats)
            dummy_weights = [0.0] * 10
            return jsonify({
                'version': 0,
                'weights': dummy_weights,
                'timestamp': None
            })
            
        return jsonify(latest_model.to_dict()), 200
    except Exception as e:
        app.logger.error(f"Federated Pull Error: {e}")
        return jsonify({'error': str(e)}), 500

def _aggregate_federated_weights():
    """
    Performs Federated Averaging (FedAvg) on all unprocessed client weights.
    Creates a new GlobalModel version.
    """
    unprocessed_records = FederatedWeight.query.filter_by(processed=False).all()
    if not unprocessed_records:
        return

    try:
        # Deserialize arrays and determine length
        arrays = [json.loads(record.weights) for record in unprocessed_records]
        if not arrays:
            return
            
        weight_length = len(arrays[0])
        num_clients = len(arrays)

        # Basic Federated Averaging (Mean)
        aggregated = [0.0] * weight_length
        for arr in arrays:
            # Ensure safe length to prevent index errors
            for i in range(min(weight_length, len(arr))):
                aggregated[i] += arr[i]

        aggregated = [val / num_clients for val in aggregated]

        # Determine next version number
        latest_model = GlobalModel.query.order_by(GlobalModel.version.desc()).first()
        next_version = (latest_model.version + 1) if latest_model else 1

        # Save new global model
        new_global = GlobalModel(
            version=next_version,
            weights=json.dumps(aggregated)
        )
        db.session.add(new_global)

        # Mark consumed records as processed
        for record in unprocessed_records:
            record.processed = True

        db.session.commit()
        app.logger.info(f"Aggregated {num_clients} client weights into Global Model v{next_version}")
        
    except Exception as e:
        app.logger.error(f"Aggregation Failed: {e}")
        db.session.rollback()

# ─── Standard Endpoints ─────────────────────────────────────────────────────────

@app.route('/api/stats', methods=['GET'])
def get_stats():
    stats = Stat.query.all()
    return jsonify([stat.to_dict() for stat in stats])

@app.route('/api/knowledge-graph', methods=['GET'])
def get_knowledge_graph():
    nodes = KnowledgeNode.query.all()
    edges = KnowledgeEdge.query.all()
    return jsonify({
        'nodes': [node.to_dict() for node in nodes],
        'edges': [[edge.source_id, edge.target_id] for edge in edges]
    })

@app.route('/api/pulse-heatmap', methods=['GET'])
def get_pulse_heatmap():
    points = HeatmapPoint.query.all()
    # Format into weeks x days array
    # Assume 12 weeks, 7 days
    if not points:
        return jsonify([])
    
    heatmap_data = [[0]*7 for _ in range(12)]
    for p in points:
        if 0 <= p.week < 12 and 0 <= p.day < 7:
            heatmap_data[p.week][p.day] = p.intensity
            
    return jsonify(heatmap_data)

@app.route('/api/skill-radar', methods=['GET'])
def get_skill_radar():
    skills = Skill.query.all()
    return jsonify([skill.to_dict() for skill in skills])

@app.route('/api/ghost-mode', methods=['GET'])
def get_ghost_mode():
    ghost_data = GhostData.query.all()
    timeline_points = TimelinePoint.query.all()
    return jsonify({
        'ghostData': [gd.to_dict() for gd in ghost_data],
        'timelinePoints': [tp.to_dict() for tp in timeline_points]
    })

@app.route('/api/nudges', methods=['GET'])
def get_nudges():
    nudges = Nudge.query.all()
    return jsonify([nudge.to_dict() for nudge in nudges])

if __name__ == '__main__':
    app.run(debug=True, port=5000)
