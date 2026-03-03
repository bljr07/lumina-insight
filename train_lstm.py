import torch
import torch.nn as nn
import torch.onnx
import os

# 1. Define Temporal Model (LSTM)
class TemporalStateClassifier(nn.Module):
    def __init__(self, input_dim=5, hidden_dim=16, num_classes=6):
        super().__init__()
        # "Temporal Deep Learning" -> LSTM
        self.lstm = nn.LSTM(input_dim, hidden_dim, batch_first=True)
        self.fc = nn.Linear(hidden_dim, num_classes)

    def forward(self, x):
        # x shape: [batch, seq_len, features]
        lstm_out, _ = self.lstm(x)
        # Take the output of the last time step
        last_out = lstm_out[:, -1, :] 
        return self.fc(last_out)

model = TemporalStateClassifier()

# 2. Fake some training data (hackathon classic)
# Features: dwell_time, scroll_velocity, mouse_jitter, tab_switches, re_read_cycles
# Let's say sequence length is 5 steps
SEQ_LEN = 5
dummy_X = torch.rand(100, SEQ_LEN, 5) # 100 random sequences
dummy_y = torch.randint(0, 6, (100,)) # 6 possible classes

criterion = nn.CrossEntropyLoss()
optimizer = torch.optim.Adam(model.parameters(), lr=0.01)

# Quick 10-epoch training just to initialize weights decently
print("Training LSTM...")
for epoch in range(10):
    optimizer.zero_grad()
    outputs = model(dummy_X)
    loss = criterion(outputs, dummy_y)
    loss.backward()
    optimizer.step()

# 3. Export to ONNX
model.eval()
dummy_input = torch.randn(1, SEQ_LEN, 5) # Shape: [Batch=1, SeqLen=5, Features=5]

# Using an absolute path to ensure we save it properly
model_path = os.path.join(os.path.dirname(__file__), "extension", "models", "student_model_v1.onnx")
if not os.path.exists(os.path.dirname(model_path)):
    os.makedirs(os.path.dirname(model_path), exist_ok=True)
    
torch.onnx.export(model, dummy_input, model_path, 
                  input_names=['input'], output_names=['output'])

print(f"Exported to {model_path}!")
