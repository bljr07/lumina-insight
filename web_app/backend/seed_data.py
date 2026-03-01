from app import app, db
from models import Stat, KnowledgeNode, KnowledgeEdge, HeatmapPoint, Skill, GhostData, TimelinePoint, Nudge
import math
import random

def seed_data():
    with app.app_context():
        # Drop and recreate tables
        db.drop_all()
        db.create_all()

        # Seed Stats
        stats = [
            Stat(icon="Flame", label="Study Streak", value="12 days", sub="+3 from last week", color="text-primary", bg="bg-primary/10"),
            Stat(icon="Battery", label="Cognitive Load", value="62%", sub="Optimal zone", color="text-lumina-success", bg="bg-lumina-success/10"),
            Stat(icon="Brain", label="Concepts Mastered", value="24 / 38", sub="63% complete", color="text-lumina-info", bg="bg-lumina-info/10"),
            Stat(icon="Clock", label="Avg. Focus Session", value="47 min", sub="↑ 8 min vs last month", color="text-lumina-warning", bg="bg-lumina-warning/10")
        ]
        db.session.bulk_save_objects(stats)

        # Seed Knowledge Graph
        nodes = [
            KnowledgeNode(label="Java", x=50, y=45, size=40, mastery=0.85),
            KnowledgeNode(label="OOP", x=30, y=25, size=32, mastery=0.78),
            KnowledgeNode(label="Data\nStructures", x=72, y=28, size=34, mastery=0.72),
            KnowledgeNode(label="APIs", x=25, y=65, size=30, mastery=0.6),
            KnowledgeNode(label="Databases", x=70, y=68, size=36, mastery=0.55),
            KnowledgeNode(label="Spring\nBoot", x=48, y=80, size=28, mastery=0.4),
            KnowledgeNode(label="Micro-\nservices", x=85, y=50, size=26, mastery=0.3),
            KnowledgeNode(label="Testing", x=15, y=45, size=24, mastery=0.65)
        ]
        db.session.add_all(nodes)
        db.session.commit() # Commit to get IDs

        edges = [
            [1, 2], [1, 3], [1, 4], [1, 5], [2, 3], [4, 6], [5, 6], [5, 7], [6, 7], [1, 8], [4, 8]
        ]
        db.session.bulk_save_objects([KnowledgeEdge(source_id=e[0], target_id=e[1]) for e in edges])

        # Seed Heatmap
        heatmap_points = []
        for w in range(12):
            for d in range(7):
                base = math.sin(w * 0.5 + d * 0.3) * 2 + 2
                intensity = max(0, min(4, round(base + (random.random() - 0.5) * 2)))
                heatmap_points.append(HeatmapPoint(week=w, day=d, intensity=intensity))
        db.session.bulk_save_objects(heatmap_points)

        # Seed Skills
        skills = [
            Skill(skill="Consistency", value=88, full_mark=100),
            Skill(skill="Resilience", value=92, full_mark=100),
            Skill(skill="Syntax", value=65, full_mark=100),
            Skill(skill="Logic", value=78, full_mark=100),
            Skill(skill="Debugging", value=82, full_mark=100),
            Skill(skill="Architecture", value=70, full_mark=100)
        ]
        db.session.bulk_save_objects(skills)

        # Seed Ghost Mode
        ghost_data = [
            GhostData(label="Logic Error Resolution", current="12 min", past="18 min", change=-33, improving=True),
            GhostData(label="Recursive Functions", current="8 min", past="22 min", change=-64, improving=True),
            GhostData(label="API Integration", current="15 min", past="12 min", change=25, improving=False),
            GhostData(label="Database Queries", current="6 min", past="14 min", change=-57, improving=True)
        ]
        db.session.bulk_save_objects(ghost_data)

        timeline_points = [
            TimelinePoint(month="Oct", score=42),
            TimelinePoint(month="Nov", score=55),
            TimelinePoint(month="Dec", score=48),
            TimelinePoint(month="Jan", score=63),
            TimelinePoint(month="Feb", score=71),
            TimelinePoint(month="Now", score=78)
        ]
        db.session.bulk_save_objects(timeline_points)

        # Seed Nudges
        nudges = [
            Nudge(icon="Coffee", type="wellbeing", title="Break suggested", message="You usually nail recursive problems after a 5-minute break. Your cognitive load is at 85%.", action="Take a break", time="2 min ago"),
            Nudge(icon="BookOpen", type="bridge", title="Prerequisite bridge", message="Before diving into JOIN optimization, review this 2-min refresher on table relationships.", action="Start refresher", time="15 min ago"),
            Nudge(icon="Zap", type="flow", title="Flow state detected", message="You're in peak performance! Mastery velocity is high. Ready for a harder challenge?", action="Challenge me", time="1 hr ago")
        ]
        db.session.bulk_save_objects(nudges)

        db.session.commit()
        print("Database seeded successfully!")

if __name__ == '__main__':
    seed_data()
