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
  // Reference for the container width
  const containerRef = React.useRef(null);
  const [medianMonths, setMedianMonths] = useState(1);
  const [percentile90, setPercentile90] = useState(6);
  const [distributionData, setDistributionData] = useState([]);
  const [error, setError] = useState("");
  const [inputMedian, setInputMedian] = useState(1);
  const [inputP90, setInputP90] = useState(24);

  // Success probability parameters
  const [success2m, setSuccess2m] = useState(20);
  const [success6m, setSuccess6m] = useState(50);
  const [success3y, setSuccess3y] = useState(90);

  // Scale parameters
  const [annualAttempts, setAnnualAttempts] = useState(1000);
  const [expectedDamage, setExpectedDamage] = useState(500000);

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

  // Function to estimate beta parameters from median and 90th percentile
  const estimateBetaParameters = (median, p90) => {
    if (median >= p90 || median <= 0 || p90 <= 0) {
      setError(
        "Median must be less than 90th percentile and both must be positive"
      );
      return null;
    }
    setError("");

    const maxMonths = Math.max(p90 * 1.5, 36); // Extend range a bit beyond p90
    const x50 = median / maxMonths;
    const x90 = p90 / maxMonths;

    // Initial guess for parameters
    let alpha = 2;
    let beta = alpha * (1 / x50 - 1);

    // Adjust parameters to match the 90th percentile better
    const ratio = alpha / beta;
    const targetX90 = 0.90;
    const currentSpread = x90 - x50;
    const targetSpread = targetX90 - 0.5;
    const scaleFactor = targetSpread / currentSpread;

    alpha = Math.max(0.5, alpha * scaleFactor);
    beta = alpha / ratio;

    return { alpha, beta, maxMonths };
  };

  // Fit logistic function to three points
  const fitLogisticCurve = (x, points) => {
    // Convert to log scale for better fitting
    const logX = Math.log(x);
    const log2m = Math.log(2);
    const log6m = Math.log(6);
    const log3y = Math.log(36); // 3 years in months

    // Simple logistic function: P(x) = 1 / (1 + e^(-k(x - x0)))
    // We'll use the middle point (6 months) as x0
    const x0 = log6m;

    // Estimate k using the spread between 2 months and 3 years
    const k =
      (Math.log(points.y3y / (100 - points.y3y)) -
        Math.log(points.y2m / (100 - points.y2m))) /
      (log3y - log2m);

    // Calculate probability
    return 100 / (1 + Math.exp(-k * (logX - x0)));
  };

  const updateDistribution = () => {
    if (inputMedian >= inputP90 || inputMedian <= 0 || inputP90 <= 0) {
      setError(
        "Median must be less than 90th percentile and both must be positive"
      );
      return;
    }
    setError("");
    setMedianMonths(inputMedian);
    setPercentile90(inputP90);

    const params = estimateBetaParameters(inputMedian, inputP90);
    if (!params) return;

    const { alpha, beta, maxMonths } = params;
    const NUM_SAMPLES = 100000; // Significantly increased number of samples for more precise estimation
    const points = [];
    const successPoints = {
      y2m: success2m,
      y6m: success6m,
      y3y: success3y,
    };

    // First, calculate the time distribution and success probability points
    for (let i = 0; i <= 100; i++) {
      const x = i / 100;
      const months = Math.exp(x * Math.log(maxMonths)); // Log scale transformation
      const normalizedX = months / maxMonths;
      const y = betaPDF(normalizedX, alpha, beta) / maxMonths; // Scale PDF to match month units
      const successProb = fitLogisticCurve(months, successPoints);

      points.push({
        months,
        probability: y,
        successProbability: successProb,
      });
    }
    setDistributionData(points);

    // Now calculate damage distribution using Monte Carlo sampling
    const singleAttemptDamages = new Array(NUM_SAMPLES).fill(0).map(() => {
      // Sample from time distribution
      const u = Math.random();
      const months = Math.exp(u * Math.log(maxMonths));
      const normalizedX = months / maxMonths;
      const successProb = fitLogisticCurve(months, successPoints) / 100;

      // For each attempt, calculate if it succeeds and the resulting damage
      const succeeds = Math.random() < successProb;
      return succeeds ? expectedDamage : 0;
    });

    // Calculate mean and standard deviation for a single attempt
    const singleMean =
      singleAttemptDamages.reduce((a, b) => a + b, 0) / NUM_SAMPLES;
    const singleVariance =
      singleAttemptDamages.reduce((a, b) => a + (b - singleMean) ** 2, 0) /
      (NUM_SAMPLES - 1);
    const singleStd = Math.sqrt(singleVariance);

    // Use Central Limit Theorem for N attempts
    const totalMean = singleMean * annualAttempts;
    const totalStd = singleStd * Math.sqrt(annualAttempts);
    setTotalAnnualDamage(totalMean);

    // Generate smooth damage distribution using normal approximation
    const damagePoints = new Array(200).fill(0).map((_, i) => {
      const damage = totalMean + totalStd * 3 * (-2 + 4 * (i / 199)); // Range: μ ± 3σ
      const z = (damage - totalMean) / totalStd;
      const probability =
        Math.exp((-z * z) / 2) / (Math.sqrt(2 * Math.PI) * totalStd);
      return {
        damage: Math.max(0, damage),
        probability: probability,
      };
    });

    setDamageDistribution(damagePoints);
  };

  return (
    <div className="App" style={{ padding: "20px" }}>
      <div>
        <h1>Annual Novice-made Bioweapon Fatalities Model</h1>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            updateDistribution();
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
                  50th percentile of effort per moderately dedicated attempt (months spent):
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      marginLeft: "4px",
                      marginRight: "4px",
                      cursor: "help",
                      position: "relative"
                    }}
                  >
                    <div
                      style={{
                        width: "16px",
                        height: "16px",
                        borderRadius: "50%",
                        backgroundColor: "#4CAF50",
                        color: "white",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "12px",
                        fontWeight: "bold",
                        position: "relative"
                      }}
                      onMouseEnter={(e) => {
                        const tooltip = e.currentTarget.nextElementSibling;
                        if (tooltip) {
                          tooltip.style.visibility = "visible";
                          tooltip.style.opacity = "1";
                        }
                      }}
                      onMouseLeave={(e) => {
                        const tooltip = e.currentTarget.nextElementSibling;
                        if (tooltip) {
                          tooltip.style.visibility = "hidden";
                          tooltip.style.opacity = "0";
                        }
                      }}
                    >
                      i
                    </div>
                    <div
                      style={{
                        visibility: "hidden",
                        width: "200px",
                        backgroundColor: "#555",
                        color: "#fff",
                        textAlign: "center",
                        padding: "10px",
                        borderRadius: "6px",
                        position: "absolute",
                        zIndex: "1",
                        bottom: "125%",
                        left: "50%",
                        marginLeft: "-100px",
                        opacity: "0",
                        transition: "opacity 0.3s",
                        fontSize: "14px",
                        fontWeight: "normal"
                      }}
                    >
                      A moderately dedicated attempt to develop a PPPis at least 3 weeks long 
                      <div
                        style={{
                          position: "absolute",
                          top: "100%",
                          left: "50%",
                          marginLeft: "-5px",
                          borderWidth: "5px",
                          borderStyle: "solid",
                          borderColor: "#555 transparent transparent transparent"
                        }}
                      />
                    </div>
                  </span>
                  <input
                    type="number"
                    value={inputMedian}
                    onChange={(e) =>
                      setInputMedian(
                        e.target.value === "" ? "" : parseFloat(e.target.value)
                      )
                    }
                    style={{ marginLeft: "10px" }}
                  />
                </label>
                <label>
                  90th percentile of effort per moderately dedicated attempt (months spent):
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      marginLeft: "4px",
                      marginRight: "4px",
                      cursor: "help",
                      position: "relative"
                    }}
                  >
                    <div
                      style={{
                        width: "16px",
                        height: "16px",
                        borderRadius: "50%",
                        backgroundColor: "#4CAF50",
                        color: "white",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "12px",
                        fontWeight: "bold",
                        position: "relative"
                      }}
                      onMouseEnter={(e) => {
                        const tooltip = e.currentTarget.nextElementSibling;
                        if (tooltip) {
                          tooltip.style.visibility = "visible";
                          tooltip.style.opacity = "1";
                        }
                      }}
                      onMouseLeave={(e) => {
                        const tooltip = e.currentTarget.nextElementSibling;
                        if (tooltip) {
                          tooltip.style.visibility = "hidden";
                          tooltip.style.opacity = "0";
                        }
                      }}
                    >
                      i
                    </div>
                    <div
                      style={{
                        visibility: "hidden",
                        width: "200px",
                        backgroundColor: "#555",
                        color: "#fff",
                        textAlign: "center",
                        padding: "10px",
                        borderRadius: "6px",
                        position: "absolute",
                        zIndex: "1",
                        bottom: "125%",
                        left: "50%",
                        marginLeft: "-100px",
                        opacity: "0",
                        transition: "opacity 0.3s",
                        fontSize: "14px",
                        fontWeight: "normal"
                      }}
                    >
                      A moderately dedicated attempt to develop a PPPis at least 3 weeks long 
                      <div
                        style={{
                          position: "absolute",
                          top: "100%",
                          left: "50%",
                          marginLeft: "-5px",
                          borderWidth: "5px",
                          borderStyle: "solid",
                          borderColor: "#555 transparent transparent transparent"
                        }}
                      />
                    </div>
                  </span>
                  <input
                    type="number"
                    value={inputP90}
                    onChange={(e) =>
                      setInputP90(
                        e.target.value === "" ? "" : parseFloat(e.target.value)
                      )
                    }
                    style={{ marginLeft: "10px" }}
                  />
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
                  Success probability given 2 months of effort (%):
                  <input
                    type="number"
                    value={success2m}
                    onChange={(e) =>
                      setSuccess2m(
                        e.target.value === "" ? "" : parseFloat(e.target.value)
                      )
                    }
                    style={{ marginLeft: "10px" }}
                    min="0"
                    max="100"
                  />
                </label>
                <label>
                  Success probability given 6 months of effort (%):
                  <input
                    type="number"
                    value={success6m}
                    onChange={(e) =>
                      setSuccess6m(
                        e.target.value === "" ? "" : parseFloat(e.target.value)
                      )
                    }
                    style={{ marginLeft: "10px" }}
                    min="0"
                    max="100"
                  />
                </label>
                <label>
                  Success probability given 3 years of effort (%):
                  <input
                    type="number"
                    value={success3y}
                    onChange={(e) =>
                      setSuccess3y(
                        e.target.value === "" ? "" : parseFloat(e.target.value)
                      )
                    }
                    style={{ marginLeft: "10px" }}
                    min="0"
                    max="100"
                  />
                </label>
              </div>
            </div>

            {/* Expected Annual Values */}
            <div>
              <h3>Number of attempts and annual fatalities per successful attempt</h3>
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
                  Expected fatalities per success:
                  <input
                    type="number"
                    value={expectedDamage}
                    onChange={(e) =>
                      setExpectedDamage(
                        e.target.value === ""
                          ? ""
                          : Math.max(0, parseInt(e.target.value))
                      )
                    }
                    style={{ marginLeft: "10px" }}
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
                  value: "Probability Density",
                  angle: -90,
                  position: "center",
                  dx: -35,
                }}
              />
              <Tooltip
                formatter={(value, name) => [value.toFixed(4), name]}
                labelFormatter={(value) => `${value.toFixed(1)} months`}
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
                dataKey="probability"
                stroke="#8884d8"
                name="Effort of moderately dedicated attempts"
                dot={false}
                yAxisId="left"
              />
              <Line
                type="monotone"
                dataKey="successProbability"
                stroke="#2e8b57"
                name="Success probability conditional on effort (%)"
                dot={false}
                yAxisId="right"
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                domain={[0, 100]}
                label={{
                  value: "Success Probability (%)",
                  angle: 90,
                  position: "center",
                  dx: 20,
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
              margin={{ top: 5, right: 30, left: 50, bottom: 25 }}
              data={damageDistribution}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="damage"
                type="number"
                label={{ value: "Annual Fatalities", position: "bottom" }}
                tickFormatter={(value) => value.toLocaleString()}
              />
              <YAxis
                label={{
                  value: "Probability Density",
                  angle: -90,
                  position: "center",
                  offset: -40,
                  dx: -50,
                }}
              />
              <Tooltip
                formatter={(value, name) => [value.toFixed(4), name]}
                labelFormatter={(value) =>
                  `$${parseInt(value).toLocaleString()}`
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
                dataKey="probability"
                stroke="#ff7300"
                name="Annual Fatalities"
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
              borderRadius: "5px",
              border: "1px solid #4CAF50",
            }}
          >
            <h3 style={{ margin: "0" }}>Expected Annual Fatalities:</h3>
            <div
              style={{
                fontSize: "24px",
                fontWeight: "bold",
                color: "#4CAF50",
                marginBottom: "15px"
              }}
            >
              {totalAnnualDamage.toLocaleString(undefined, {
                maximumFractionDigits: 0,
              })}
            </div>
            <div style={{ display: "flex", justifyContent: "center" }}>
              <button
                type="submit"
                style={{
                  padding: "8px 16px",
                  backgroundColor: "#4CAF50",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                  width: "200px"
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
