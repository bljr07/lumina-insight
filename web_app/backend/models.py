from flask_sqlalchemy import SQLAlchemy
import json

db = SQLAlchemy()

class Stat(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    icon = db.Column(db.String(50))
    label = db.Column(db.String(100))
    value = db.Column(db.String(50))
    sub = db.Column(db.String(100))
    color = db.Column(db.String(50))
    bg = db.Column(db.String(50))

    def to_dict(self):
        return {
            'icon': self.icon,
            'label': self.label,
            'value': self.value,
            'sub': self.sub,
            'color': self.color,
            'bg': self.bg
        }

class KnowledgeNode(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    label = db.Column(db.String(100))
    x = db.Column(db.Float)
    y = db.Column(db.Float)
    size = db.Column(db.Float)
    mastery = db.Column(db.Float)

    def to_dict(self):
        return {
            'id': self.id,
            'label': self.label,
            'x': self.x,
            'y': self.y,
            'size': self.size,
            'mastery': self.mastery
        }

class KnowledgeEdge(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    source_id = db.Column(db.Integer, db.ForeignKey('knowledge_node.id'))
    target_id = db.Column(db.Integer, db.ForeignKey('knowledge_node.id'))

class HeatmapPoint(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    week = db.Column(db.Integer)
    day = db.Column(db.Integer)
    intensity = db.Column(db.Integer)

class Skill(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    skill = db.Column(db.String(100))
    value = db.Column(db.Integer)
    full_mark = db.Column(db.Integer)

    def to_dict(self):
        return {
            'skill': self.skill,
            'value': self.value,
            'fullMark': self.full_mark
        }

class GhostData(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    label = db.Column(db.String(100))
    current = db.Column(db.String(50))
    past = db.Column(db.String(50))
    change = db.Column(db.Integer)
    improving = db.Column(db.Boolean)

    def to_dict(self):
        return {
            'label': self.label,
            'current': self.current,
            'past': self.past,
            'change': self.change,
            'improving': self.improving
        }

class TimelinePoint(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    month = db.Column(db.String(10))
    score = db.Column(db.Integer)

    def to_dict(self):
        return {
            'month': self.month,
            'score': self.score
        }

class Nudge(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    icon = db.Column(db.String(50))
    type = db.Column(db.String(50))
    title = db.Column(db.String(100))
    message = db.Column(db.Text)
    action = db.Column(db.String(50))
    time = db.Column(db.String(50))

    def to_dict(self):
        return {
            'icon': self.icon,
            'type': self.type,
            'title': self.title,
            'message': self.message,
            'action': self.action,
            'time': self.time
        }

class FederatedWeight(db.Model):
    __tablename__ = 'federated_weight'
    id = db.Column(db.Integer, primary_key=True)
    client_id = db.Column(db.String(100), nullable=False)
    weights = db.Column(db.Text, nullable=False) # Store JSON string of float array
    timestamp = db.Column(db.DateTime, server_default=db.func.now())
    processed = db.Column(db.Boolean, default=False)

class GlobalModel(db.Model):
    __tablename__ = 'global_model'
    id = db.Column(db.Integer, primary_key=True)
    version = db.Column(db.Integer, nullable=False, unique=True)
    weights = db.Column(db.Text, nullable=False) # Store JSON string of float array
    timestamp = db.Column(db.DateTime, server_default=db.func.now())

    def to_dict(self):
        parsed_weights = []
        try:
            raw = json.loads(self.weights)
            if isinstance(raw, list):
                parsed_weights = raw
        except Exception:
            parsed_weights = []

        return {
            'version': self.version,
            'weights': parsed_weights,
            'timestamp': self.timestamp.isoformat() if self.timestamp else None
        }

# --- New models based on schema.sql ---

class Profile(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.String(100), unique=True) # UUID from the frontend
    name = db.Column(db.String(100))
    education = db.Column(db.String(50))
    year = db.Column(db.Integer)
    course = db.Column(db.String(100))
    created_at = db.Column(db.DateTime, default=db.func.now())
    updated_at = db.Column(db.DateTime, default=db.func.now(), onupdate=db.func.now())

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'name': self.name,
            'education': self.education,
            'year': self.year,
            'course': self.course
        }

class StudySession(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.String(100))
    started_at = db.Column(db.DateTime, default=db.func.now())
    ended_at = db.Column(db.DateTime)
    duration_minutes = db.Column(db.Integer)
    topics = db.Column(db.String(500)) # JSON string array
    intensity = db.Column(db.Integer)
    focus_score = db.Column(db.Float)
    distractions = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=db.func.now())

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'started_at': self.started_at.isoformat() if self.started_at else None,
            'ended_at': self.ended_at.isoformat() if self.ended_at else None,
            'duration_minutes': self.duration_minutes,
            'topics': json.loads(self.topics) if self.topics else [],
            'intensity': self.intensity,
            'focus_score': self.focus_score,
            'distractions': self.distractions
        }

class TopicMastery(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.String(100))
    topic = db.Column(db.String(100))
    mastery = db.Column(db.Float, default=0.0)
    time_spent_hours = db.Column(db.Float, default=0.0)
    last_studied_at = db.Column(db.DateTime, default=db.func.now())
    subtopics = db.Column(db.String(500)) # JSON array

    def to_dict(self):
        return {
            'id': self.id,
            'topic': self.topic,
            'mastery': self.mastery,
            'time_spent_hours': self.time_spent_hours,
            'last_studied_at': self.last_studied_at.isoformat() if self.last_studied_at else None,
            'subtopics': json.loads(self.subtopics) if self.subtopics else []
        }

class QuizResult(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.String(100))
    total_cards = db.Column(db.Integer)
    correct = db.Column(db.Integer)
    score = db.Column(db.Float)
    card_details = db.Column(db.Text) # JSON mapping
    completed_at = db.Column(db.DateTime, default=db.func.now())

    def to_dict(self):
        return {
            'id': self.id,
            'total_cards': self.total_cards,
            'correct': self.correct,
            'score': self.score,
            'card_details': json.loads(self.card_details) if self.card_details else [],
            'completed_at': self.completed_at.isoformat() if self.completed_at else None
        }

class BreakLog(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.String(100))
    duration_minutes = db.Column(db.Integer)
    ringtone = db.Column(db.String(100))
    started_at = db.Column(db.DateTime, default=db.func.now())
    completed = db.Column(db.Boolean, default=False)

    def to_dict(self):
        return {
            'id': self.id,
            'duration_minutes': self.duration_minutes,
            'ringtone': self.ringtone,
            'started_at': self.started_at.isoformat() if self.started_at else None,
            'completed': self.completed
        }

class FocusSession(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.String(100))
    duration_seconds = db.Column(db.Integer)
    started_at = db.Column(db.DateTime, default=db.func.now())

    def to_dict(self):
        return {
            'id': self.id,
            'duration_seconds': self.duration_seconds,
            'started_at': self.started_at.isoformat() if self.started_at else None
        }

class Milestone(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.String(100))
    month = db.Column(db.String(10))
    mastery_score = db.Column(db.Float)
    label = db.Column(db.String(100))
    recorded_at = db.Column(db.DateTime, default=db.func.now())

    def to_dict(self):
        return {
            'id': self.id,
            'month': self.month,
            'mastery_score': self.mastery_score,
            'label': self.label,
            'recorded_at': self.recorded_at.isoformat() if self.recorded_at else None
        }

class DailyActivity(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.String(100))
    date = db.Column(db.Date) # Use db.Date
    total_minutes = db.Column(db.Integer, default=0)
    intensity = db.Column(db.Integer, default=0)
    topics = db.Column(db.String(500)) # JSON Array
    session_count = db.Column(db.Integer, default=0)

    def to_dict(self):
        return {
            'id': self.id,
            'date': self.date.isoformat() if self.date else None,
            'total_minutes': self.total_minutes,
            'intensity': self.intensity,
            'topics': json.loads(self.topics) if self.topics else [],
            'session_count': self.session_count
        }
