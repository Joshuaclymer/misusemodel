import React, { useState, useEffect, useRef } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import jStat from "jstat";
import * as math from "mathjs";
import "./App.css";

const PlotParameters = ({ 
  label,
  parameters,
  onParametersChange,
  style,
  anchorMonths
}) => {
  return (
    <div style={style}>
      <h4 style={{ marginBottom: '15px' }}>{label}</h4>
      <div style={{ marginBottom: '20px' }}>
        <h5>Effort Distribution Parameters</h5>
        <div>
          <label>Effort at {anchorMonths[0]} months (%):</label>
          <input
            type="number"
            value={parameters.effortanch1}
            onChange={(e) => onParametersChange({ ...parameters, effortanch1: parseFloat(e.target.value) })}
            style={{ width: '80px', marginLeft: '10px' }}
          />
        </div>
        <div>
          <label>Effort at {anchorMonths[1]} months (%):</label>
          <input
            type="number"
            value={parameters.effortanch2}
            onChange={(e) => onParametersChange({ ...parameters, effortanch2: parseFloat(e.target.value) })}
            style={{ width: '80px', marginLeft: '10px' }}
          />
        </div>
        <div>
          <label>Effort at {anchorMonths[2]} months (%):</label>
          <input
            type="number"
            value={parameters.effortanch3}
            onChange={(e) => onParametersChange({ ...parameters, effortanch3: parseFloat(e.target.value) })}
            style={{ width: '80px', marginLeft: '10px' }}
          />
        </div>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <h5>Success Probability Parameters</h5>
        <div>
          <label>Success at {anchorMonths[0]} months (%):</label>
          <input
            type="number"
            value={parameters.successanch1}
            onChange={(e) => onParametersChange({ ...parameters, successanch1: parseFloat(e.target.value) })}
            style={{ width: '80px', marginLeft: '10px' }}
          />
        </div>
        <div>
          <label>Success at {anchorMonths[1]} months (%):</label>
          <input
            type="number"
            value={parameters.successanch2}
            onChange={(e) => onParametersChange({ ...parameters, successanch2: parseFloat(e.target.value) })}
            style={{ width: '80px', marginLeft: '10px' }}
          />
        </div>
        <div>
          <label>Success at {anchorMonths[2]} months (%):</label>
          <input
            type="number"
            value={parameters.successanch3}
            onChange={(e) => onParametersChange({ ...parameters, successanch3: parseFloat(e.target.value) })}
            style={{ width: '80px', marginLeft: '10px' }}
          />
        </div>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <h5>Scale Parameters</h5>
        <div>
          <label>Annual Attempts:</label>
          <input
            type="number"
            value={parameters.annualAttempts}
            onChange={(e) => onParametersChange({ ...parameters, annualAttempts: parseFloat(e.target.value) })}
            style={{ width: '80px', marginLeft: '10px' }}
          />
        </div>
        <div>
          <label>Expected Damage:</label>
          <input
            type="number"
            value={parameters.expectedDamage}
            onChange={(e) => onParametersChange({ ...parameters, expectedDamage: parseFloat(e.target.value) })}
            style={{ width: '80px', marginLeft: '10px' }}
          />
        </div>
      </div>
    </div>
  );
};

function App() {
  const anchor_months = [3, 12, 36];
  const containerRef = React.useRef(null);
  const [error, setError] = useState("");
  const [preDistributionData, setPreDistributionData] = useState([]);
  const [postDistributionData, setPostDistributionData] = useState([]);
  const [containerWidth, setContainerWidth] = useState(0);

  // Pre-mitigation parameters
  const [preMitigationParams, setPreMitigationParams] = useState({
    effortanch1: 90,
    effortanch2: 95,
    effortanch3: 98,
    successanch1: 0.1,
    successanch2: 3,
    successanch3: 10,
    annualAttempts: 10,
    expectedDamage: 1
  });

  // Post-mitigation parameters
  const [postMitigationParams, setPostMitigationParams] = useState({
    effortanch1: 90,
    effortanch2: 95,
    effortanch3: 98,
    successanch1: 0.1,
    successanch2: 3,
    successanch3: 10,
    annualAttempts: 10,
    expectedDamage: 1
  });

  // Handle window resize
  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth);
      }
    };

    window.addEventListener("resize", updateWidth);
    updateWidth(); // Initial width

    return () => window.removeEventListener("resize", updateWidth);
  }, []);

  // Initial calculation
  useEffect(() => {
    updateDistribution();
  }, []);

  // Beta distribution PDF function
  const betaPDF = (x, alpha, beta) => {
    if (x <= 0 || x >= 1) return 0;
    try {
      const lnBeta =
        math.lgamma(alpha) + math.lgamma(beta) - math.lgamma(alpha + beta);
      const betaFunc = Math.exp(lnBeta);
      return (Math.pow(x, alpha - 1) * Math.pow(1 - x, beta - 1)) / betaFunc;
    } catch (err) {
      return 0;
    }
  };

  // Function to estimate log-normal parameters from three percentile points
  const estimateLogNormalParameters = (panch1, panch2, panch3) => {
    if (
      panch1 >= panch2 ||
      panch2 >= panch3 ||
      panch1 < 0 ||
      panch2 < 0 ||
      panch3 < 0 ||
      panch3 > 100
    ) {
      setError("Percentiles must be in increasing order and between 0 and 100");
      return null;
    }
    setError("");

    // Fit monotonic cubic Hermite spline for CDF
    const fitEffortCDF = (x) => {
      const logX = Math.log(x);
      const xs = [
        Math.log(0.1),
        Math.log(anchor_months[0]),
        Math.log(anchor_months[1]),
        Math.log(anchor_months[2]),
      ]; // x coordinates in log space
      const ys = [0, panch1, panch2, 1]; // y coordinates, start at 0 and end at 1

      // Compute slopes between points
      const slopes = [];
      for (let i = 0; i < xs.length - 1; i++) {
        slopes.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
      }

      // Compute tangents using Fritsch-Carlson method
      const tangents = new Array(xs.length);
      tangents[0] = slopes[0] * 1.5; // Moderate increase in initial slope for concavity while maintaining monotonicity
      tangents[xs.length - 1] = 0; // Force horizontal at end

      // For middle points, use harmonic mean if slopes have same sign
      for (let i = 1; i < xs.length - 1; i++) {
        if (slopes[i - 1] * slopes[i] > 0) {
          const w1 = 2 * slopes[i] + slopes[i - 1];
          const w2 = slopes[i] + 2 * slopes[i - 1];
          tangents[i] = (w1 + w2) / (3 * (w1 / slopes[i - 1] + w2 / slopes[i]));
        } else {
          tangents[i] = Math.min(slopes[i - 1], slopes[i]); // Take smaller slope for smoothness
        }
      }

      // Smooth extrapolation for points outside the range
      if (logX <= xs[0]) {
        return 0; // Start at exactly 0
      }
      if (logX >= xs[3]) {
        return 1; // End at exactly 1
      }

      // Find the appropriate segment
      let i = 0;
      while (i < xs.length - 1 && logX > xs[i + 1]) i++;

      // Compute the interpolation
      const h = xs[i + 1] - xs[i];
      const t = (logX - xs[i]) / h;

      // Hermite basis functions
      const h00 = 2 * t * t * t - 3 * t * t + 1;
      const h10 = t * t * t - 2 * t * t + t;
      const h01 = -2 * t * t * t + 3 * t * t;
      const h11 = t * t * t - t * t;

      // Interpolate and clamp to [0,1]
      return Math.min(
        1,
        Math.max(
          0,
          h00 * ys[i] +
            h10 * h * tangents[i] +
            h01 * ys[i + 1] +
            h11 * h * tangents[i + 1]
        )
      );
    };

    return { fitEffortCDF };
  };

  // Fit monotonic cubic Hermite spline through three points
  const fitLogisticCurve = (x, points) => {
    // Convert to log scale for interpolation
    const logX = Math.log(x);
    const xs = [
      Math.log(0.1),
      Math.log(anchor_months[0]),
      Math.log(anchor_months[1]),
      Math.log(anchor_months[2]),
    ]; // x coordinates in log space
    const ys = [
      0,
      points.yanch1 / 100,
      points.yanch2 / 100,
      points.yanch3 / 100,
    ]; // y coordinates starting at 0

    // Compute slopes between points
    const slopes = [];
    for (let i = 0; i < xs.length - 1; i++) {
      slopes.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
    }

    // Compute tangents using Fritsch-Carlson method to ensure monotonicity
    const tangents = new Array(xs.length);
    tangents[0] = slopes[0] * 1.5; // Moderate increase in initial slope
    tangents[xs.length - 1] = slopes[slopes.length - 1] * 0.5; // Gentler slope at end

    // For middle points, use harmonic mean if slopes have same sign
    for (let i = 1; i < xs.length - 1; i++) {
      if (slopes[i - 1] * slopes[i] > 0) {
        const w1 = 2 * slopes[i] + slopes[i - 1];
        const w2 = slopes[i] + 2 * slopes[i - 1];
        tangents[i] = (w1 + w2) / (3 * (w1 / slopes[i - 1] + w2 / slopes[i]));
      } else {
        tangents[i] = 0; // Ensure smoothness at inflection points
      }
    }

    // Ensure monotonicity by adjusting tangents
    for (let i = 0; i < xs.length; i++) {
      if (i > 0) {
        const alpha = tangents[i] / slopes[i - 1];
        if (alpha < 0) tangents[i] = 0;
        else if (alpha > 3) tangents[i] = 3 * slopes[i - 1];
      }
      if (i < slopes.length) {
        const beta = tangents[i] / slopes[i];
        if (beta < 0) tangents[i] = 0;
        else if (beta > 3) tangents[i] = 3 * slopes[i];
      }
    }

    // Handle points outside the range
    if (logX <= xs[0]) {
      return 0; // Start at exactly 0
    }
    if (logX >= xs[3]) {
      return Math.min(1, ys[3] + tangents[3] * (logX - xs[3]) * 0.1); // Gentle extrapolation
    }

    // Find the appropriate segment
    let i = 0;
    while (i < xs.length - 1 && logX > xs[i + 1]) i++;

    // Compute the interpolation
    const h = xs[i + 1] - xs[i];
    const t = (logX - xs[i]) / h;

    // Hermite basis functions
    const h00 = 2 * t * t * t - 3 * t * t + 1;
    const h10 = t * t * t - 2 * t * t + t;
    const h01 = -2 * t * t * t + 3 * t * t;
    const h11 = t * t * t - t * t;

    // Interpolate and ensure bounds
    return Math.min(
      1,
      Math.max(
        0,
        h00 * ys[i] +
          h10 * h * tangents[i] +
          h01 * ys[i + 1] +
          h11 * h * tangents[i + 1]
      )
    );
  };

  const calculateDistribution = (params) => {
    const { fitEffortCDF } = estimateLogNormalParameters(
      params.effortanch1 / 100,
      params.effortanch2 / 100,
      1
    );
    if (!fitEffortCDF) return null;

    const points = [];
    const successPoints = {
      yanch1: params.successanch1,
      yanch2: params.successanch2,
      yanch3: params.successanch3,
    };

    // Calculate the time distribution and success probability points
    for (let i = 0; i <= 100; i++) {
      const x = i / 100;
      // Use log scale from 0.1 months to 60 months (5 years)
      const months = Math.exp(
        Math.log(0.1) + x * (Math.log(60) - Math.log(0.1))
      );

      // Calculate both CDFs directly using spline interpolation
      const successProb = fitLogisticCurve(months, successPoints);
      const cumulativeProb = fitEffortCDF(months);

      points.push({
        months,
        probability: 0, // We're not using PDF anymore
        cumulativeProbability: cumulativeProb,
        successProbability: successProb,
      });
    }

    return points;
  };

  const calculateExpectedFatalities = (points, params) => {
    if (!points || points.length < 2) return 0;
    
    let expectation = 0;
    for (let i = 1; i < points.length; i++) {
      expectation +=
        (points[i].cumulativeProbability - points[i - 1].cumulativeProbability) *
        points[i].successProbability *
        params.annualAttempts *
        params.expectedDamage *
        1000000;
    }
    return expectation;
  };

  const updateDistribution = () => {
    try {
      const prePoints = calculateDistribution(preMitigationParams);
      const postPoints = calculateDistribution(postMitigationParams);
      
      if (!prePoints || !postPoints) return;

      setPreDistributionData(prePoints);
      setPostDistributionData(postPoints);
      setError("");
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className="App" style={{ padding: "20px" }}>
      <div>
        <h1>Annual Novice-Made Bioweapon Fatalities Model</h1>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            updateDistribution();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && e.target.tagName === "INPUT") {
              e.preventDefault();
              updateDistribution();
            }
          }}
        >
          <div
            ref={containerRef}
            style={{ display: "flex", flexDirection: "column", maxWidth: "1400px", margin: "0 auto", gap: "20px" }}>
            <div style={{ display: "flex", justifyContent: "center", gap: "40px" }}>
              <h2 style={{ flex: 1, textAlign: "center", margin: 0, maxWidth: "500px" }}>Baseline</h2>
              <h2 style={{ flex: 1, textAlign: "center", margin: 0, maxWidth: "500px" }}>Pre-Mitigation Deployment</h2>
            </div>
            
            <div style={{ display: "flex", gap: "40px" }}>
              {/* Left Column */}
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "30px" }}>
              <PlotParameters
                label="Baseline Parameters"
                parameters={preMitigationParams}
                onParametersChange={setPreMitigationParams}
                style={{ width: "100%", maxWidth: "500px" }}
                anchorMonths={anchor_months}
              />

              <div style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center" }}>
                <h3 style={{ textAlign: "center", marginBottom: "20px" }}>
                  Distribution
                </h3>
                <LineChart
                  width={Math.min(800, (containerWidth - 80) / 2)}
                  height={350}
                  margin={{ top: 5, right: 50, left: 50, bottom: 25 }}
                  data={preDistributionData}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="months"
                    scale="log"
                    domain={["auto", "auto"]}
                    type="number"
                    label={{
                      value: "Months (log scale)",
                      position: "bottom",
                      offset: 20,
                    }}
                    tickFormatter={(value) => value.toFixed(1)}
                  />
                  <YAxis
                    yAxisId="left"
                    label={{
                      value: "Cumulative Probability",
                      angle: -90,
                      position: "center",
                      dx: -35,
                    }}
                  />
                  <Tooltip
                    formatter={(value, name) => [value.toFixed(4), name]}
                    labelFormatter={(value) =>
                      `${value.toFixed(1)} months of effort`
                    }
                  />
                  <Legend
                    layout="horizontal"
                    align="center"
                    verticalAlign="bottom"
                    wrapperStyle={{
                      paddingTop: "10px",
                      bottom: -10,
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="cumulativeProbability"
                    stroke="#8884d8"
                    name="CDF(Effort of attempt)"
                    dot={false}
                    yAxisId="left"
                  />
                  <Line
                    type="monotone"
                    dataKey="successProbability"
                    stroke="#2e8b57"
                    name="Success probability conditional on effort"
                    dot={false}
                    yAxisId="right"
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    domain={[0, 1]}
                    label={{
                      value: "Success Probability",
                      angle: 90,
                      position: "center",
                      dx: 30,
                    }}
                  />
                </LineChart>
              </div>

              <div style={{ textAlign: "center", width: "100%" }}>
                <h3 style={{ margin: "0 0 10px 0" }}>Expected Annual Fatalities</h3>
                <div style={{ fontSize: "24px", fontWeight: "bold" }}>
                  {calculateExpectedFatalities(preDistributionData, preMitigationParams).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </div>
              </div>
            </div>

            {/* Right Column */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "30px" }}>
              <PlotParameters
                label="Pre-Mitigation Deployment Parameters"
                parameters={postMitigationParams}
                onParametersChange={setPostMitigationParams}
                style={{ width: "100%", maxWidth: "500px" }}
                anchorMonths={anchor_months}
              />

              <div style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center" }}>
                <h3 style={{ textAlign: "center", marginBottom: "20px" }}>
                  Distribution
                </h3>
                <LineChart
                  width={Math.min(800, (containerWidth - 80) / 2)}
                  height={350}
                  margin={{ top: 5, right: 50, left: 50, bottom: 25 }}
                  data={postDistributionData}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="months"
                    scale="log"
                    domain={["auto", "auto"]}
                    type="number"
                    label={{
                      value: "Months (log scale)",
                      position: "bottom",
                      offset: 20,
                    }}
                    tickFormatter={(value) => value.toFixed(1)}
                  />
                  <YAxis
                    yAxisId="left"
                    label={{
                      value: "Cumulative Probability",
                      angle: -90,
                      position: "center",
                      dx: -35,
                    }}
                  />
                  <Tooltip
                    formatter={(value, name) => [value.toFixed(4), name]}
                    labelFormatter={(value) =>
                      `${value.toFixed(1)} months of effort`
                    }
                  />
                  <Legend
                    layout="horizontal"
                    align="center"
                    verticalAlign="bottom"
                    wrapperStyle={{
                      paddingTop: "10px",
                      bottom: -10,
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="cumulativeProbability"
                    stroke="#8884d8"
                    name="CDF(Effort of attempt)"
                    dot={false}
                    yAxisId="left"
                  />
                  <Line
                    type="monotone"
                    dataKey="successProbability"
                    stroke="#2e8b57"
                    name="Success probability conditional on effort"
                    dot={false}
                    yAxisId="right"
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    domain={[0, 1]}
                    label={{
                      value: "Success Probability",
                      angle: 90,
                      position: "center",
                      dx: 30,
                    }}
                  />
                </LineChart>
              </div>

              <div style={{ textAlign: "center", width: "100%" }}>
                <h3 style={{ margin: "0 0 10px 0" }}>Expected Annual Fatalities</h3>
                <div style={{ fontSize: "24px", fontWeight: "bold" }}>
                  {calculateExpectedFatalities(postDistributionData, postMitigationParams).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </div>
              </div>
            </div>
          </div>

          {error && (
            <div style={{ color: "red", textAlign: "center", marginTop: "20px" }}>{error}</div>
          )}

          <div style={{ display: "flex", justifyContent: "center", marginTop: "40px", marginBottom: "20px" }}>
            <button
              onClick={() => updateDistribution()}
              type="button"
              style={{
                padding: "12px 24px",
                backgroundColor: "#4CAF50",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                width: "200px",
                fontSize: "16px"
              }}
            >
              Refresh
            </button>
          </div>
          </div>
        </form>
      </div>
    </div>
  );
}

export default App;
