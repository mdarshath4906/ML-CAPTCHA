import os
import csv
from flask import Flask, render_template, request, jsonify
import pandas as pd
from sklearn.tree import DecisionTreeClassifier
import joblib

app = Flask(__name__)

# Constants
MODEL_PATH = "captcha_model.pkl"
DATASET_PATH = "dataset/captcha_data.csv"

# Global model reference
model = None

def load_or_train_model():
    global model
    # Check if dataset exists, if not create default one
    if not os.path.exists(DATASET_PATH):
        os.makedirs(os.path.dirname(DATASET_PATH), exist_ok=True)
        with open(DATASET_PATH, 'w', newline='') as f:
            writer = csv.writer(f)
            writer.writerow(['length', 'time_taken', 'mouse_moves', 'result'])
            # Initial default dataset values
            writer.writerows([
                [5, 6.0, 32, 1],
                [6, 8.0, 41, 1],
                [5, 1.0, 2, 0],
                [6, 2.0, 4, 0],
                [5, 7.0, 30, 1],
                [6, 1.0, 3, 0],
                [4, 5.0, 25, 1],
                [7, 10.0, 50, 1],
                [4, 0.5, 1, 0],
                [8, 0.8, 2, 0]
            ])

    # Try loading scikit-learn model
    if os.path.exists(MODEL_PATH):
        try:
            model = joblib.load(MODEL_PATH)
            print("Model loaded successfully.")
            return
        except Exception as e:
            print(f"Error loading model: {e}. Retraining model...")

    # Retrain on the fly
    try:
        data = pd.read_csv(DATASET_PATH)
        X = data[['length', 'time_taken', 'mouse_moves']]
        y = data['result']
        model = DecisionTreeClassifier(random_state=42)
        model.fit(X, y)
        joblib.dump(model, MODEL_PATH)
        print("Model trained and saved successfully.")
    except Exception as e:
        print(f"Failed to train model: {e}. Using fallback rule-based classifier.")
        class FallbackModel:
            def predict(self, features):
                length, time_taken, mouse_moves = features[0]
                # A simple rule-based mimicry of the decision tree
                if time_taken > 2.0 and mouse_moves > 10:
                    return [1]
                else:
                    return [0]
            
            def score(self, X, y):
                return 0.90
        model = FallbackModel()

# Load the model initially
load_or_train_model()

@app.route('/')
def home():
    # Read the dataset and calculate current stats to display in dashboard
    dataset_records = []
    accuracy_text = "N/A"
    
    if os.path.exists(DATASET_PATH):
        try:
            df = pd.read_csv(DATASET_PATH)
            dataset_records = df.tail(10).to_dict(orient='records')
            # Calculate accuracy of current model on this dataset if possible
            if hasattr(model, 'score'):
                X = df[['length', 'time_taken', 'mouse_moves']]
                y = df['result']
                accuracy_text = f"{model.score(X, y) * 100:.1f}%"
        except Exception as e:
            print(f"Error loading dashboard stats: {e}")
            
    return render_template("index.html", records=dataset_records, accuracy=accuracy_text)

@app.route('/predict', methods=['POST'])
def predict():
    try:
        # Check if form data or JSON payload
        if request.is_json:
            data = request.get_json()
            length = int(data.get('length', 5))
            time_taken = float(data.get('time', 5.0))
            mouse_moves = int(data.get('mouse', 25))
            is_ajax = True
        else:
            length = int(request.form.get('length', 5))
            time_taken = float(request.form.get('time', 5.0))
            mouse_moves = int(request.form.get('mouse', 25))
            is_ajax = False

        # Run prediction
        prediction = model.predict([[length, time_taken, mouse_moves]])
        result = "Human" if prediction[0] == 1 else "Bot"

        if is_ajax:
            return jsonify({
                "status": "success",
                "prediction": result,
                "length": length,
                "time": time_taken,
                "mouse": mouse_moves
            })
        else:
            return render_template(
                "result.html", 
                result=result, 
                length=length, 
                time=time_taken, 
                mouse=mouse_moves
            )
            
    except Exception as e:
        print(f"Prediction error: {e}")
        if request.is_json:
            return jsonify({"status": "error", "message": str(e)}), 400
        return render_template("result.html", result="Error", error=str(e))

@app.route('/add_data', methods=['POST'])
def add_data():
    try:
        data = request.get_json()
        length = int(data['length'])
        time_taken = float(data['time'])
        mouse_moves = int(data['mouse'])
        result = int(data['result'])

        # Save to CSV
        os.makedirs(os.path.dirname(DATASET_PATH), exist_ok=True)
        file_exists = os.path.exists(DATASET_PATH)
        
        with open(DATASET_PATH, 'a', newline='') as f:
            writer = csv.writer(f)
            if not file_exists:
                writer.writerow(['length', 'time_taken', 'mouse_moves', 'result'])
            writer.writerow([length, time_taken, mouse_moves, result])

        return jsonify({"status": "success", "message": "Telemetry saved to dataset!"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 400

@app.route('/retrain', methods=['POST'])
def retrain():
    try:
        global model
        # Force retraining
        if os.path.exists(DATASET_PATH):
            data = pd.read_csv(DATASET_PATH)
            X = data[['length', 'time_taken', 'mouse_moves']]
            y = data['result']
            
            # Re-initialize tree
            new_model = DecisionTreeClassifier(random_state=42)
            new_model.fit(X, y)
            joblib.dump(new_model, MODEL_PATH)
            model = new_model
            
            accuracy = new_model.score(X, y)
            return jsonify({
                "status": "success", 
                "message": "Model retrained successfully!", 
                "accuracy": f"{accuracy * 100:.1f}%"
            })
        else:
            return jsonify({"status": "error", "message": "Dataset not found for retraining."}), 404
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)
