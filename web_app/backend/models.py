from flask_sqlalchemy import SQLAlchemy

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
