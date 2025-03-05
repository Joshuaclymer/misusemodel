import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

const EffortParameters = ({ preMitigationParams, setPreMitigationParams, anchor_months }) => (
  <div style={{ width: "400px" }}>
    <h4 style={{ textAlign: "center", marginBottom: "20px" }}>Effort Distribution Parameters</h4>
    <div style={{ display: "flex", gap: "20px" }}>
      {[0, 1, 2].map((index) => (
        <div key={index} style={{ flex: 1 }}>
          <label>Effort at {anchor_months[index]} months (%):</label>
          <input
            type="number"
            value={preMitigationParams[`effortanch${index + 1}`]}
            onChange={(e) =>
              setPreMitigationParams({
                ...preMitigationParams,
                [`effortanch${index + 1}`]: parseFloat(e.target.value),
              })
            }
            style={{ width: "80px", marginLeft: "10px" }}
          />
        </div>
      ))}
    </div>
  </div>
);

const ScaleParameters = ({ preMitigationParams, setPreMitigationParams }) => (
  <div style={{ width: "400px" }}>
    <h4 style={{ textAlign: "center", marginBottom: "20px" }}>Scale Parameters</h4>
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      <div>
        <label>Annual Attempts:</label>
        <input
          type="number"
          value={preMitigationParams.annualAttempts}
          onChange={(e) =>
            setPreMitigationParams({
              ...preMitigationParams,
              annualAttempts: parseFloat(e.target.value),
            })
          }
          style={{ width: "80px", marginLeft: "10px" }}
        />
      </div>
      <div>
        <label>Expected Damage (millions):</label>
        <input
          type="number"
          value={preMitigationParams.expectedDamage}
          onChange={(e) =>
            setPreMitigationParams({
              ...preMitigationParams,
              expectedDamage: parseFloat(e.target.value),
            })
          }
          style={{ width: "80px", marginLeft: "10px" }}
        />
      </div>
    </div>
  </div>
);

const CDFPlot = ({ preDistributionData }) => (
  <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
    <h3 style={{ textAlign: "center", marginBottom: "20px" }}>CDF of effort of attempt</h3>
    <LineChart
      width={400}
      height={350}
      data={preDistributionData}
      margin={{ top: 5, right: 50, left: 50, bottom: 25 }}
    >
      <CartesianGrid strokeDasharray="3 3" />
      <XAxis
        dataKey="months"
        type="number"
        scale="log"
        domain={[1, 12]}
        label={{
          value: "Months of effort",
          position: "bottom",
          offset: 20,
        }}
      />
      <YAxis
        domain={[0, 100]}
        label={{
          value: "Cumulative probability (%)",
          angle: -90,
          position: "center",
          dx: -35,
        }}
      />
      <Tooltip
        formatter={(value) => [`${value.toFixed(2)}%`, "Probability"]}
        labelFormatter={(value) => `${value.toFixed(1)} months`}
      />
      <Line
        type="monotone"
        dataKey="probability"
        stroke="#8884d8"
        dot={false}
      />
    </LineChart>
  </div>
);

const ExpertAssessment = ({ 
  preMitigationParams, 
  setPreMitigationParams, 
  anchor_months, 
  preDistributionData,
  calculateExpectedFatalities
}) => {
  return (
    <div style={{
      flex: "1",
      display: "flex",
      flexDirection: "column",
      gap: "40px",
      backgroundColor: "#f5f5f5",
      padding: "30px",
      borderRadius: "10px",
    }}>
      <h2 style={{ textAlign: "center", margin: "0" }}>Evidence from Expert Assessment</h2>

      <div style={{ display: "flex", gap: "40px", justifyContent: "center" }}>
        <EffortParameters 
          preMitigationParams={preMitigationParams}
          setPreMitigationParams={setPreMitigationParams}
          anchor_months={anchor_months}
        />
        <ScaleParameters 
          preMitigationParams={preMitigationParams}
          setPreMitigationParams={setPreMitigationParams}
        />
      </div>

      <CDFPlot preDistributionData={preDistributionData} />

      <div style={{ display: "flex", gap: "40px", justifyContent: "center" }}>
        <div style={{ width: "400px", display: "flex", flexDirection: "column", alignItems: "center", gap: "20px" }}>
          <h3 style={{ margin: "0" }}>Baseline</h3>
          <div style={{ textAlign: "center" }}>
            <h4 style={{ margin: "0 0 10px 0" }}>Expected Annual Fatalities</h4>
            <div style={{ fontSize: "24px", fontWeight: "bold" }}>
              {calculateExpectedFatalities(
                preDistributionData,
                preMitigationParams
              ).toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExpertAssessment;
