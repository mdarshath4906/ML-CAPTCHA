import os
import pandas as pd
from sklearn.tree import DecisionTreeClassifier
import joblib

def train():
    dataset_path = "dataset/captcha_data.csv"
    model_path = "captcha_model.pkl"
    
    if not os.path.exists(dataset_path):
        print(f"Error: Dataset not found at {dataset_path}")
        return
        
    print("Loading dataset...")
    data = pd.read_csv(dataset_path)

    # Features and labels
    X = data[['length', 'time_taken', 'mouse_moves']]
    y = data['result']

    print("Training Decision Tree Classifier...")
    model = DecisionTreeClassifier(random_state=42)
    model.fit(X, y)

    # Calculate training accuracy
    accuracy = model.score(X, y)
    print(f"Model trained with training accuracy: {accuracy * 100:.2f}%")

    print(f"Saving model to {model_path}...")
    joblib.dump(model, model_path)
    print("Model Saved Successfully!")

if __name__ == "__main__":
    train()
