from flask import Flask, jsonify, request
from flask_cors import CORS
from models import db, Stat, KnowledgeNode, KnowledgeEdge, HeatmapPoint, Skill, GhostData, TimelinePoint, Nudge
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
