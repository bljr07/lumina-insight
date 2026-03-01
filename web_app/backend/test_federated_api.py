import json
import os
import tempfile
import unittest

from app import app, db, FEDERATED_WEIGHT_DIMENSION
from models import FederatedWeight, GlobalModel


class FederatedApiTestCase(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        fd, db_path = tempfile.mkstemp(suffix=".db")
        os.close(fd)
        cls._db_path = db_path
        app.config["TESTING"] = True
        app.config["SQLALCHEMY_DATABASE_URI"] = f"sqlite:///{db_path}"

    @classmethod
    def tearDownClass(cls):
        try:
            os.remove(cls._db_path)
        except OSError:
            pass

    def setUp(self):
        self.ctx = app.app_context()
        self.ctx.push()
        db.drop_all()
        db.create_all()
        self.client = app.test_client()

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.ctx.pop()

    def test_pull_returns_array_weights(self):
        res = self.client.get("/api/federated/pull")
        self.assertEqual(res.status_code, 200)
        payload = res.get_json()
        self.assertIsInstance(payload["weights"], list)
        self.assertEqual(len(payload["weights"]), FEDERATED_WEIGHT_DIMENSION)

    def test_push_rejects_invalid_weight_payload(self):
        res = self.client.post(
            "/api/federated/push",
            json={"client_id": "c1", "weights": [0.1, "bad", 0.2]},
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn("weights must be a non-empty numeric array", res.get_json()["error"])

    def test_push_rejects_mismatched_model_dimension(self):
        existing = GlobalModel(version=1, weights=json.dumps([0.0] * FEDERATED_WEIGHT_DIMENSION))
        db.session.add(existing)
        db.session.commit()

        res = self.client.post(
            "/api/federated/push",
            json={"client_id": "c2", "weights": [0.1, 0.2]},
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn("weights length mismatch", res.get_json()["error"])

    def test_aggregation_computes_mean_for_equal_length_vectors(self):
        vectors = [
            [0.0] * FEDERATED_WEIGHT_DIMENSION,
            [1.0] * FEDERATED_WEIGHT_DIMENSION,
            [2.0] * FEDERATED_WEIGHT_DIMENSION,
        ]
        for idx, vec in enumerate(vectors, start=1):
            res = self.client.post(
                "/api/federated/push", json={"client_id": f"c{idx}", "weights": vec}
            )
            self.assertEqual(res.status_code, 200)

        model = GlobalModel.query.order_by(GlobalModel.version.desc()).first()
        self.assertIsNotNone(model)
        model_weights = json.loads(model.weights)
        self.assertEqual(len(model_weights), FEDERATED_WEIGHT_DIMENSION)
        self.assertEqual(model_weights, [1.0] * FEDERATED_WEIGHT_DIMENSION)


if __name__ == "__main__":
    unittest.main()
