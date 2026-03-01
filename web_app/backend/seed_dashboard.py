from app import app, db
from models import GhostData, Skill

def seed_db():
    with app.app_context():
        # Clear existing
        GhostData.query.delete()
        Skill.query.delete()

        # Seed GhostData (Self-Comparison)
        ghost_entries = [
            GhostData(label='Focus Duration', current='42m', past='38m', change=10, improving=True),
            GhostData(label='Distraction Frequency', current='12', past='15', change=20, improving=True),
            GhostData(label='Problem Solving Pace', current='Slow', past='Average', change=15, improving=False),
            GhostData(label='Content Re-reads', current='5', past='8', change=37, improving=True)
        ]
        db.session.bulk_save_objects(ghost_entries)

        # Seed Skill Radar
        skill_entries = [
            Skill(skill='Syntax Comprehension', value=85, full_mark=100),
            Skill(skill='Logic Tracing', value=70, full_mark=100),
            Skill(skill='Pattern Recognition', value=90, full_mark=100),
            Skill(skill='Algorithmic Thinking', value=60, full_mark=100),
            Skill(skill='Debugging Speed', value=75, full_mark=100)
        ]
        db.session.bulk_save_objects(skill_entries)

        db.session.commit()
        print("Database Seeded Successfully for Phase 4 Vue.js Dashboard.")

if __name__ == '__main__':
    seed_db()
