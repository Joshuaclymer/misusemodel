import React, { useState, useEffect } from "react";
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

function App() {
  const anchor_months = [3, 12, 36];
  // Reference for the container width
  const containerRef = React.useRef(null);
  const [effortanch1, setEffortanch1] = useState(90);
  const [effortanch2, setEffortanch2] = useState(95);
  const [effortanch3, setEffortanch3] = useState(98);
  const [distributionData, setDistributionData] = useState([]);
  const [error, setError] = useState("");

  // Success probability parameters
  const [successanch1, setSuccessanch1] = useState(0.1);
  const [successanch2, setSuccessanch2] = useState(3);
  const [successanch3, setSuccessanch3] = useState(10);

  // Scale parameters
  const [annualAttempts, setAnnualAttempts] = useState(10);
  const [expectedDamage, setExpectedDamage] = useState(1);

  // Results
  const [totalAnnualDamage, setTotalAnnualDamage] = useState(0);
  const [damageDistribution, setDamageDistribution] = useState([]);
  const [containerWidth, setContainerWidth] = useState(0);

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

  const updateDistribution = () => {
    const { fitEffortCDF } = estimateLogNormalParameters(
      effortanch1 / 100,
      effortanch2 / 100,
      1
    );
    if (!fitEffortCDF) return;

    const points = [];
    const successPoints = {
      yanch1: successanch1,
      yanch2: successanch2,
      yanch3: successanch3,
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

    setDistributionData(points);

    // Create points for the distribution by computing PDF from CDF
    const damagePoints = [];
    for (let i = 1; i < points.length; i++) {
      // Compute PDF as derivative of CDF using finite differences
      const fatalities =
        points[i].successProbability * annualAttempts * expectedDamage * 1000000;

      const probability = points[i].cumulativeProbability - points[i - 1].cumulativeProbability;

      damagePoints.push({
        damage: fatalities,
        probability: probability,
      });
    }

    // Sort by damage for proper display
    damagePoints.sort((a, b) => a.damage - b.damage);

    // calculate mean via pdf
    let expectation1 = 0;
    for (let i = 1; i < damagePoints.length; i++) {
      expectation1 += damagePoints[i].probability  * damagePoints[i].damage;
    }
    console.log(expectation1)

    // Calculate mean annual fatalities directly from the original points
    let expectation = 0;
    for (let i = 1; i < points.length; i++) {
      expectation += (points[i].cumulativeProbability - points[i - 1].cumulativeProbability) * points[i].successProbability * annualAttempts * expectedDamage * 1000000;
    }
    setTotalAnnualDamage(expectation);

    setDamageDistribution(damagePoints);
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
            if (e.key === 'Enter' && e.target.tagName === 'INPUT') {
              e.preventDefault();
              updateDistribution();
            }
          }}
        >
          <div
            style={{
              marginBottom: "20px",
              display: "flex",
              gap: "40px",
              justifyContent: "center",
            }}
          >
            {/* Attempt Effort Distribution */}
            <div>
              <h3>Distribution of Attempt Effort</h3>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                  marginTop: "10px",
                }}
              >
                <label>
                  Percentage of attempts taking less than {anchor_months[0]}{" "}
                  months:
                  <input
                    type="number"
                    value={effortanch1}
                    onChange={(e) =>
                      setEffortanch1(
                        e.target.value === "" ? "" : parseFloat(e.target.value)
                      )
                    }
                    style={{ marginLeft: "10px" }}
                    min="0"
                    max="100"
                  />
                  <span style={{ marginLeft: "5px" }}>%</span>
                </label>
                <label>
                  Percentage of attempts taking less than {anchor_months[1]}{" "}
                  months:
                  <input
                    type="number"
                    value={effortanch2}
                    onChange={(e) =>
                      setEffortanch2(
                        e.target.value === "" ? "" : parseFloat(e.target.value)
                      )
                    }
                    style={{ marginLeft: "10px" }}
                    min="0"
                    max="100"
                  />
                  <span style={{ marginLeft: "5px" }}>%</span>
                </label>
                <label>
                  Percentage of attempts taking less than {anchor_months[2]}{" "}
                  months:
                  <input
                    type="number"
                    value={effortanch3}
                    onChange={(e) =>
                      setEffortanch3(
                        e.target.value === "" ? "" : parseFloat(e.target.value)
                      )
                    }
                    style={{ marginLeft: "10px" }}
                    min="0"
                    max="100"
                  />
                  <span style={{ marginLeft: "5px" }}>%</span>
                </label>
              </div>
            </div>

            {/* Success Probability Distribution */}
            <div>
              <h3>Success Probability Given Effort</h3>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                  marginTop: "10px",
                }}
              >
                <label>
                  Success probability given {anchor_months[0]} months of effort:
                  <input
                    type="number"
                    value={successanch1}
                    onChange={(e) =>
                      setSuccessanch1(
                        e.target.value === "" ? "" : parseFloat(e.target.value)
                      )
                    }
                    style={{ marginLeft: "10px" }}
                    min="0"
                    max="100"
                    step="0.1"
                  />
                  <span style={{ marginLeft: "5px" }}>%</span>
                </label>
                <label>
                  Success probability given {anchor_months[1]} months of effort:
                  <input
                    type="number"
                    value={successanch2}
                    onChange={(e) =>
                      setSuccessanch2(
                        e.target.value === "" ? "" : parseFloat(e.target.value)
                      )
                    }
                    style={{ marginLeft: "10px" }}
                    min="0"
                    max="100"
                    step="0.1"
                  />
                  <span style={{ marginLeft: "5px" }}>%</span>
                </label>
                <label>
                  Success probability given {anchor_months[2]} months of effort:
                  <input
                    type="number"
                    value={successanch3}
                    onChange={(e) =>
                      setSuccessanch3(
                        e.target.value === "" ? "" : parseFloat(e.target.value)
                      )
                    }
                    style={{ marginLeft: "10px" }}
                    min="0"
                    max="100"
                    step="0.1"
                  />
                  <span style={{ marginLeft: "5px" }}>%</span>
                </label>
              </div>
            </div>

            {/* Expected Annual Values */}
            <div>
              <h3>
                Number of attempts and annual fatalities per successful attempt
              </h3>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                  marginTop: "10px",
                }}
              >
                <label>
                  Expected number of attempts annually:
                  <input
                    type="number"
                    value={annualAttempts}
                    onChange={(e) =>
                      setAnnualAttempts(
                        e.target.value === ""
                          ? ""
                          : Math.max(0, parseInt(e.target.value))
                      )
                    }
                    style={{ marginLeft: "10px" }}
                  />
                </label>
                <label>
                  Expected fatalities per success (millions):
                  <input
                    type="number"
                    value={expectedDamage}
                    onChange={(e) =>
                      setExpectedDamage(
                        e.target.value === ""
                          ? ""
                          : Math.max(0, parseFloat(e.target.value))
                      )
                    }
                    style={{ marginLeft: "10px" }}
                    step="0.1"
                  />
                </label>
              </div>
            </div>
          </div>

          {error && (
            <div style={{ color: "red", marginTop: "10px" }}>{error}</div>
          )}

          <div
            ref={containerRef}
            style={{
              display: "flex",
              flexDirection: "row",
              gap: "40px",
              marginTop: "20px",
              justifyContent: "center",
              maxWidth: "1400px",
              margin: "20px auto",
            }}
          >
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
              }}
            >
              <h3 style={{ textAlign: "center", marginBottom: "20px" }}>
                Effort Distribution and Conditional Success Probability
              </h3>
              <LineChart
                width={Math.min(800, (containerWidth - 80) / 2)}
                height={350}
                margin={{ top: 5, right: 50, left: 50, bottom: 25 }}
                data={distributionData}
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

            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
              }}
            >
              <h3 style={{ textAlign: "center", marginBottom: "20px" }}>
                Annual Fatalities
              </h3>
              <LineChart
                width={Math.min(800, (containerWidth - 80) / 2)}
                height={350}
                margin={{ top: 5, right: 30, left: 50, bottom: 45 }}
                data={damageDistribution}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="damage"
                  type="number"
                  scale="log"
                  domain={["auto", "auto"]}
                  label={{
                    value: "Annual Fatalities (log scale)",
                    position: "bottom",
                    offset: 10,
                  }}
                  tickFormatter={(value) => value.toExponential(1)}
                />
                <YAxis
                  label={{
                    value: "Probability Density",
                    angle: -90,
                    position: "center",
                    offset: -40,
                    dx: -50,
                  }}
                  tickFormatter={(value) => value.toExponential(1)}
                />
                <Tooltip
                  formatter={(value, name) => {
                    // Round to 2 significant figures
                    const sigFigs = Number(value).toPrecision(2);
                    return [sigFigs, name];
                  }}
                  labelFormatter={(value) =>
                    // Round to 2 significant figures for the label too
                    `${Number(value).toPrecision(2)} Annual Fatalities`
                  }
                />
                {/* <Legend
                  layout="horizontal"
                  align="center"
                  verticalAlign="bottom"
                  wrapperStyle={{
                    paddingTop: "10px",
                    bottom: -10,
                  }}
                /> */}
                <Line
                  type="monotone"
                  dataKey="probability"
                  stroke="#ff7300"
                  name="Probability Density"
                  dot={false}
                />
              </LineChart>
            </div>
          </div>

          <div
            style={{
              marginTop: "40px",
              padding: "15px",
              backgroundColor: "#f0f8ff",
              borderRadius: "0px",
              // border: "1px solid #ff7300",
            }}
          >
            <h3 style={{ margin: "0" }}>Expected Annual Fatalities:</h3>
            <div
              style={{
                fontSize: "24px",
                fontWeight: "bold",
                color: "#ff7300",
                marginBottom: "15px",
              }}
            >
              {totalAnnualDamage.toLocaleString(undefined, {
                maximumFractionDigits: 0,
              })}
            </div>
            <div style={{ display: "flex", justifyContent: "center" }}>
              <button
                onClick={() => updateDistribution()}
                type="button"
                style={{
                  padding: "8px 16px",
                  backgroundColor: "#ff7300",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                  width: "200px",
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
