import torch
import torch.nn as nn
import torch.onnx
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

os.makedirs('c:/Users/Ethan/Downloads/lumina-insight/extension/models', exist_ok=True)

class DummyModel(nn.Module):
    def __init__(self):
        super().__init__()
        self.fc1 = nn.Linear(5, 10)
        self.relu = nn.ReLU()
        self.fc2 = nn.Linear(10, 6)
        
    def forward(self, x):
        return self.fc2(self.relu(self.fc1(x)))

model = DummyModel()
dummy_input = torch.randn(1, 5)

torch.onnx.export(
    model, 
    dummy_input, 
    'c:/Users/Ethan/Downloads/lumina-insight/extension/models/student_model_v1.onnx', 
    export_params=True, 
    opset_version=14, 
    input_names=['input'], 
    output_names=['output'], 
    dynamic_axes={'input' : {0 : 'batch_size'}, 'output' : {0 : 'batch_size'}}
)
print("Model exported successfully.")
