/**
 * REZ ML Studio - Custom Model Training UI
 *
 * Features:
 * - Data upload
 * - Model selection
 * - Training configuration
 * - Experiment tracking
 * - Model deployment
 */

import React from 'react';

export default function MLTraining() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">ML Training Studio</h1>

      {/* Model Selection */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">1. Select Model Type</h2>
        <div className="grid grid-cols-3 gap-4">
          {[
            { id: 'classification', name: 'Classification', desc: 'Binary or multi-class', icon: '🎯' },
            { id: 'regression', name: 'Regression', desc: 'Predict continuous values', icon: '📊' },
            { id: 'recommendation', name: 'Recommendation', desc: 'Product/user recommendations', icon: '💡' },
            { id: 'anomaly', name: 'Anomaly Detection', desc: 'Fraud, outliers', icon: '⚠️' },
            { id: 'nlp', name: 'NLP', desc: 'Text classification, sentiment', icon: '📝' },
            { id: 'churn', name: 'Churn Prediction', desc: 'Customer churn scoring', icon: '🔄' }
          ].map(model => (
            <div key={model.id} className="border rounded-lg p-4 cursor-pointer hover:border-blue-500">
              <div className="text-2xl mb-2">{model.icon}</div>
              <p className="font-medium">{model.name}</p>
              <p className="text-sm text-gray-500">{model.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Data Upload */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">2. Upload Training Data</h2>
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
          <div className="text-4xl mb-2">📁</div>
          <p className="text-gray-600">Drag & drop CSV or JSON files</p>
          <p className="text-sm text-gray-400">Max 1GB per file</p>
          <button className="mt-4 px-4 py-2 bg-blue-600 text-white rounded">Browse Files</button>
        </div>
        <div className="mt-4">
          <p className="text-sm font-medium mb-2">Or connect data source:</p>
          <div className="flex gap-2">
            <button className="px-3 py-1 border rounded text-sm">MongoDB</button>
            <button className="px-3 py-1 border rounded text-sm">BigQuery</button>
            <button className="px-3 py-1 border rounded text-sm">S3</button>
            <button className="px-3 py-1 border rounded text-sm">API</button>
          </div>
        </div>
      </div>

      {/* Training Config */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">3. Configure Training</h2>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium mb-1">Training Split</label>
            <input type="range" min="60" max="90" defaultValue="80" className="w-full" />
            <p className="text-sm text-gray-500">80% train / 20% test</p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Epochs</label>
            <input type="number" defaultValue="100" className="w-full border rounded px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Learning Rate</label>
            <select className="w-full border rounded px-3 py-2">
              <option>0.001 (Default)</option>
              <option>0.0001 (Fine-tune)</option>
              <option>0.01 (Fast)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Model Architecture</label>
            <select className="w-full border rounded px-3 py-2">
              <option>Neural Network</option>
              <option>XGBoost</option>
              <option>Random Forest</option>
              <option>Logistic Regression</option>
            </select>
          </div>
        </div>
      </div>

      {/* Training Jobs */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="text-lg font-semibold">Training Jobs</h2>
          <button className="px-4 py-2 bg-blue-600 text-white rounded">+ New Training</button>
        </div>
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-3 text-left">Model</th>
              <th className="p-3 text-left">Status</th>
              <th className="p-3 text-left">Accuracy</th>
              <th className="p-3 text-left">Started</th>
              <th className="p-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t">
              <td className="p-3">Churn Predictor v2</td>
              <td className="p-3"><span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">Training</span></td>
              <td className="p-3">78%</td>
              <td className="p-3">2 min ago</td>
              <td className="p-3">
                <button className="text-red-600 text-sm">Stop</button>
              </td>
            </tr>
            <tr className="border-t">
              <td className="p-3">Fraud Detector v3</td>
              <td className="p-3"><span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">Completed</span></td>
              <td className="p-3">97.2%</td>
              <td className="p-3">1 hour ago</td>
              <td className="p-3">
                <button className="text-blue-600 text-sm mr-2">Deploy</button>
                <button className="text-gray-600 text-sm">View</button>
              </td>
            </tr>
            <tr className="border-t">
              <td className="p-3">Intent Classifier</td>
              <td className="p-3"><span className="px-2 py-1 bg-gray-100 text-gray-800 rounded text-xs">Failed</span></td>
              <td className="p-3">-</td>
              <td className="p-3">3 hours ago</td>
              <td className="p-3">
                <button className="text-red-600 text-sm">Retry</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Experiments */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">A/B Experiments</h2>
        <div className="space-y-4">
          <div className="border rounded-lg p-4">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-medium">Pricing Model v2 vs v1</p>
                <p className="text-sm text-gray-500">Testing new pricing algorithm</p>
              </div>
              <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">Running</span>
            </div>
            <div className="mt-3 flex gap-4">
              <div>
                <p className="text-xs text-gray-500">Control (v1)</p>
                <p className="font-medium">+12.5% conversion</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Variant (v2)</p>
                <p className="font-medium text-green-600">+18.2% conversion</p>
              </div>
            </div>
            <div className="mt-2 text-xs text-gray-400">Confidence: 89% • Sample: 12,450</div>
          </div>
        </div>
      </div>
    </div>
  );
}
