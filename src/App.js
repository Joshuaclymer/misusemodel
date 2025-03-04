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
  const [effort2m, setEffort2m] = useState(90); // 2 month percentile
  const [effort6m, setEffort6m] = useState(95); // 6 month percentile
  const [effort3y, setEffort3y] = useState(98); // 3 year percentile
  const [distributionData, setDistributionData] = useState([]);
  const [error, setError] = useState("");

  // Success probability parameters
  const [success2m, setSuccess2m] = useState(0.1);
  const [success6m, setSuccess6m] = useState(3);
  const [success3y, setSuccess3y] = useState(10);

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
  const estimateLogNormalParameters = (p2m, p6m, p3y) => {
    if (
      p2m >= p6m ||
      p6m >= p3y ||
      p2m < 0 ||
      p6m < 0 ||
      p3y < 0 ||
      p3y > 100
    ) {
      setError("Percentiles must be in increasing order and between 0 and 100");
      return null;
    }
    setError("");

    // Fit monotonic cubic Hermite spline for CDF
    const fitEffortCDF = (x) => {
      const logX = Math.log(x);
      const xs = [Math.log(0.1), Math.log(2), Math.log(6), Math.log(36)];  // x coordinates in log space
      const ys = [0, p2m, p6m, 1];  // y coordinates, start at 0 and end at 1
      
      // Compute slopes between points
      const slopes = [];
      for (let i = 0; i < xs.length - 1; i++) {
        slopes.push((ys[i+1] - ys[i]) / (xs[i+1] - xs[i]));
      }
      
      // Compute tangents using Fritsch-Carlson method
      const tangents = new Array(xs.length);
      tangents[0] = slopes[0] * 1.5;  // Moderate increase in initial slope for concavity while maintaining monotonicity
      tangents[xs.length-1] = 0;  // Force horizontal at end
      
      // For middle points, use harmonic mean if slopes have same sign
      for (let i = 1; i < xs.length - 1; i++) {
        if (slopes[i-1] * slopes[i] > 0) {
          const w1 = 2 * slopes[i] + slopes[i-1];
          const w2 = slopes[i] + 2 * slopes[i-1];
          tangents[i] = (w1 + w2) / (3 * (w1 / slopes[i-1] + w2 / slopes[i]));
        } else {
          tangents[i] = Math.min(slopes[i-1], slopes[i]);  // Take smaller slope for smoothness
        }
      }
      
      // Smooth extrapolation for points outside the range
      if (logX <= xs[0]) {
        return 0;  // Start at exactly 0
      }
      if (logX >= xs[3]) {
        return 1;  // End at exactly 1
      }
      
      // Find the appropriate segment
      let i = 0;
      while (i < xs.length - 1 && logX > xs[i+1]) i++;
      
      // Compute the interpolation
      const h = xs[i+1] - xs[i];
      const t = (logX - xs[i]) / h;
      
      // Hermite basis functions
      const h00 = 2*t*t*t - 3*t*t + 1;
      const h10 = t*t*t - 2*t*t + t;
      const h01 = -2*t*t*t + 3*t*t;
      const h11 = t*t*t - t*t;
      
      // Interpolate and clamp to [0,1]
      return Math.min(1, Math.max(0, 
        h00*ys[i] + h10*h*tangents[i] + h01*ys[i+1] + h11*h*tangents[i+1]
      ));
    };
    
    return { fitEffortCDF };
  };

  // Fit monotonic cubic Hermite spline through three points
  const fitLogisticCurve = (x, points) => {
    // Convert to log scale for interpolation
    const logX = Math.log(x);
    const xs = [Math.log(2), Math.log(6), Math.log(36)];  // x coordinates in log space
    const ys = [points.y2m / 100, points.y6m / 100, points.y3y / 100];  // y coordinates
    
    // Compute slopes between points
    const slopes = [];
    for (let i = 0; i < xs.length - 1; i++) {
      slopes.push((ys[i+1] - ys[i]) / (xs[i+1] - xs[i]));
    }
    
    // Initialize tangents using Fritsch-Carlson method to ensure monotonicity
    const tangents = new Array(xs.length);
    
    // Set initial values based on slopes
    tangents[0] = slopes[0];
    tangents[xs.length-1] = slopes[slopes.length-1];
    
    // For the middle point, use harmonic mean if slopes have same sign
    if (slopes[0] * slopes[1] > 0) {
      const w1 = 2 * slopes[1] + slopes[0];
      const w2 = slopes[1] + 2 * slopes[0];
      tangents[1] = (w1 + w2) / (3 * (w1 / slopes[0] + w2 / slopes[1]));
    } else {
      tangents[1] = 0;
    }
    
    // Adjust tangents to ensure monotonicity (Fritsch-Carlson conditions)
    for (let i = 0; i < xs.length; i++) {
      if (i > 0 && slopes[i-1] === 0) tangents[i] = 0;
      if (i < slopes.length && slopes[i] === 0) tangents[i] = 0;
      
      if (i > 0 && i < slopes.length) {
        const alpha = tangents[i] / slopes[i-1];
        const beta = tangents[i] / slopes[i];
        if (alpha * alpha + beta * beta > 9) {
          const tau = 3 / Math.sqrt(alpha * alpha + beta * beta);
          tangents[i] *= tau;
        }
      }
    }
    
    // Smooth extrapolation for points outside the range
    if (logX <= xs[0]) {
      return Math.max(0, Math.min(1, ys[0]));
    }
    if (logX >= xs[2]) {
      return Math.max(0, Math.min(1, ys[2]));
    }
    
    // Find the appropriate segment
    let i = 0;
    while (i < xs.length - 1 && logX > xs[i+1]) i++;
    
    // Compute the interpolation
    const h = xs[i+1] - xs[i];
    const t = (logX - xs[i]) / h;
    
    // Hermite basis functions
    const h00 = 2*t*t*t - 3*t*t + 1;
    const h10 = t*t*t - 2*t*t + t;
    const h01 = -2*t*t*t + 3*t*t;
    const h11 = t*t*t - t*t;
    
    // Interpolate and ensure output is between 0 and 1
    return Math.max(0, Math.min(1,
      h00*ys[i] + h10*h*tangents[i] + h01*ys[i+1] + h11*h*tangents[i+1]
    ));
  };

  const updateDistribution = () => {
    const { fitEffortCDF } = estimateLogNormalParameters(effort2m / 100, effort6m / 100, 1);
    if (!fitEffortCDF) return;

    const points = [];
    const successPoints = {
      y2m: success2m,
      y6m: success6m,
      y3y: success3y,
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

    // Calculate annual fatalities distribution
    const numPoints = 200;
    const damageValue = expectedDamage * 1000000; // Convert from millions to absolute
    const damagePoints = [];

    // Helper function to find effort required for a given success probability
    // Uses binary search since success probability is monotonic in effort
    const findEffortForSuccessProb = (targetProb) => {
      if (targetProb <= 0) return points[0].months;
      if (targetProb >= 1) return points[points.length - 1].months;

      let prob = 0;
      for (let i = 0; i < points.length; i++) {
        prob = points[i].successProbability;
        console.log(prob, targetProb);
        if (prob > targetProb) return points[i].months;
      }
      console.log("Failed to find effort for success probability");
    };

    console.log(findEffortForSuccessProb(0.03));

    // this is under construction, don't worry about it
    // // For a range of success probabilities
    // const maxSuccessProb = Math.max(
    //   ...points.map(p => fitLogisticCurve(p.months, successPoints))
    // );

    // // Create points for the distribution
    // for (let i = 0; i < numPoints; i++) {
    //   // Sample success probabilities on a log scale to better capture rare events
    //   const successProb = maxSuccessProb * Math.exp(Math.log(1e-6) * (1 - i / (numPoints - 1)));

    //   // Find required effort for this success probability
    //   const requiredEffort = findEffortForSuccessProb(successProb);

    //   // Find probability that effort is less than required effort (from CDF)
    //   let effortProb = 0;
    //   for (let j = 0; j < points.length; j++) {
    //     if (points[j].months > requiredEffort) {
    //       if (j === 0) {
    //         effortProb = 0;
    //       } else {
    //         // Linear interpolation of CDF
    //         const t = (requiredEffort - points[j-1].months) / (points[j].months - points[j-1].months);
    //         effortProb = points[j-1].cumulativeProbability * (1 - t) + points[j].cumulativeProbability * t;
    //       }
    //       break;
    //     }
    //   }

    // Calculate annual fatalities for this probability
    //   const annualSuccessProb = successProb * annualAttempts; // Expected number of successes per year
    //   const annualFatalities = annualSuccessProb * damageValue;

    //   // Add point if probability is non-zero
    //   if (effortProb > 0) {
    //     damagePoints.push({
    //       damage: annualFatalities,
    //       probability: effortProb,
    //     });
    //   }
    // }

    // // Sort by damage for proper display
    // damagePoints.sort((a, b) => a.damage - b.damage);

    // // Calculate mean annual fatalities
    // const totalMean = damagePoints.reduce((sum, point) =>
    //   sum + point.damage * point.probability, 0);
    // setTotalAnnualDamage(totalMean);

    // setDamageDistribution(damagePoints);
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
                  Percentage of attempts taking less than 2 months:
                  <input
                    type="number"
                    value={effort2m}
                    onChange={(e) =>
                      setEffort2m(
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
                  Percentage of attempts taking less than 6 months:
                  <input
                    type="number"
                    value={effort6m}
                    onChange={(e) =>
                      setEffort6m(
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
                  Percentage of attempts taking less than 3 years:
                  <input
                    type="number"
                    value={effort3y}
                    onChange={(e) =>
                      setEffort3y(
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
                  Success probability given 2 months of effort:
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
                    step="0.1"
                  />
                  <span style={{ marginLeft: "5px" }}>%</span>
                </label>
                <label>
                  Success probability given 6 months of effort:
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
                    step="0.1"
                  />
                  <span style={{ marginLeft: "5px" }}>%</span>
                </label>
                <label>
                  Success probability given 3 years of effort:
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
                type="submit"
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
