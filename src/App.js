import React, { useState, useEffect, useRef } from "react";
import "./App.css";
import EffortCDF from "./components/EffortCDF.jsx";
import QueriesVsTime from "./components/QueriesVsTime.jsx";
import { fitQueriesCurve } from "./components/QueriesVsTime.jsx";
import SuccessGivenEffort from "./components/SuccessGivenEffort.jsx";
import ComparisonSuccessGivenEffort from "./components/ComparisonSuccessGivenEffort.jsx";
import ExpectedAnnualFatalities from "./components/ExpectedAnnualFatalities.jsx";
import BansVsQueries from "./components/BansVsQueries.jsx";
import { getBansForQueries, getBanCurve } from "./components/BansVsQueries.jsx";
import { generateCurvePoints } from "./utils/curves.js";
import TimeLostToBans from "./components/TimeLostToBans.jsx";
import { getTimeLostGivenBans } from "./components/TimeLostToBans.jsx";
import QueriesVsTimeWithBans from "./components/QueriesVsTimeWithBans.jsx";
import { generateCDFData } from "./components/EffortCDF.jsx";

import {
  runModel,
  getPostMitigationSuccessProbabilityGivenEffort,
} from "./utils/model.js";

// Maximum time in months for pre-mitigation and baseline curves
export const maxTimeMonths = 60; // 60 months

function App() {
  const [error, setError] = useState({ message: "", stack: "" });

  // Input parameters
  // Initialize baseline and pre-mitigation text fields
  const [baselineTextFields, setBaselineTextFields] = useState({
    successanch1: 0.1,
    successanch2: 3,
    successanch3: 10,
  });

  const [preMitigationTextFields, setPreMitigationTextFields] = useState({
    successanch1: 0.1,
    successanch2: 3,
    successanch3: 10,
  });

  // Initialize input parameters
  const [inputParams, setInputParams] = useState({
    baselineSuccessProbabilityGivenEffort: [],
    preMitigationSuccessProbabilityGivenEffort: [],
    timeToExecuteQueries: [],
    effortCDF: [],
    expectedFatalitiesPerSuccessfulAttempt: 1000000,
    expectedAnnualAttempts: 5,
    queriesAttackerExecutesPerMonth: 30,
    banCurve: [],
    bansVsQueries: [],
  });

  // Initialize data on mount
  useEffect(() => {
    const initialTimeToExecuteQueries = [
      { time: 0, queries: 0, fixed: true },
      { time: 22.5, queries: 10 }, // Middle point slightly above the diagonal
      { time: 45, queries: 45 }, // End at max x,y
    ];

    const initialBansVsQueries = [
      { time: 0, queries: 0, fixed: true },
      { time: 20, queries: 19 }, // Middle point slightly above the diagonal
      { time: 45, queries: 30 }, // End at max x,y
    ];

    const initialTimeLostToBans = [
      { time: 0, queries: 0, fixed: true }, // Fixed starting point
      { time: 5, queries: 1 }, // First control point
      { time: 15, queries: 3 }, // Middle point
      { time: 45, queries: 3.2 }, // End point
    ];

    const initialEffortPoints = {
      effortanch1: 90,
      effortanch2: 95,
      effortanch3: 98,
    };

    const initialParams = {
      baselineSuccessProbabilityGivenEffort:
        generateCurvePoints(baselineTextFields),
      preMitigationSuccessProbabilityGivenEffort: generateCurvePoints(
        preMitigationTextFields
      ),
      timeToExecuteQueries: fitQueriesCurve(initialTimeToExecuteQueries),
      banCurve: getBanCurve(initialBansVsQueries),
      bansVsQueries: getBansForQueries(initialBansVsQueries),
      timeLostToBans: getTimeLostGivenBans(initialTimeLostToBans),
      expectedFatalitiesPerSuccessfulAttempt: 1000000,
      expectedAnnualAttempts: 5,
      effortCDF: generateCDFData(initialEffortPoints),
      queriesAttackerExecutesPerMonth: 30,
    };

    setInputParams(initialParams);

    // Run model with initial data
    try {
      const initialOutputParams = runModel(initialParams);
      setOutputParams(initialOutputParams);
    } catch (e) {
      setError({ message: e.message, stack: e.stack });
    }
  }, []); // Empty dependency array since this is initialization code

  // Output parameters
  const [outputParams, setOutputParams] = useState({
    postMitigationSuccessProbabilityGivenEffort: [],
    baselineExpectedAnnualFatalities: null,
    preMitigationExpectedAnnualFatalities: null,
    postMitigationExpectedAnnualFatalities: null,
  });

  // Update input params whenever text fields change
  useEffect(() => {
    try {
      setInputParams(prev => ({
        ...prev,
        baselineSuccessProbabilityGivenEffort: generateCurvePoints(baselineTextFields),
        preMitigationSuccessProbabilityGivenEffort: generateCurvePoints(preMitigationTextFields)
      }));
    } catch (e) {
      setError({ message: e.message, stack: e.stack });
    }
  }, [baselineTextFields, preMitigationTextFields]);

  // Run model whenever input params change
  useEffect(() => {
    try {
      const newOutputParams = runModel(inputParams);
      setOutputParams(newOutputParams);
      setError({ message: "", stack: "" });
    } catch (e) {
      setError({ message: e.message, stack: e.stack });
    }
  }, [inputParams]);

  return (
    <div className="App" style={{ padding: "20px" }}>
      <div>
        <h1>Annual Novice-Made Bioweapon Fatalities Model</h1>
        <form
          onSubmit={(e) => {
            e.preventDefault();
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              maxWidth: "1400px",
              margin: "0 auto",
              gap: "40px",
            }}
          >
            {/* Top Parameters Section */}
            <div
              style={{
                display: "flex",
                gap: "40px",
                justifyContent: "center",
                flexWrap: "wrap",
              }}
            >
              <div style={{ width: "400px" }}>
                <div
                  style={{
                    display: "flex",
                    gap: "20px",
                    justifyContent: "center",
                  }}
                >
                  <div>
                    <label>Expected Annual Attempts:</label>
                    <input
                      type="number"
                      value={inputParams.expectedAnnualAttempts}
                      onChange={(e) => {
                        const value = e.target.value;
                        setInputParams((prev) => ({
                          ...prev,
                          expectedAnnualAttempts:
                            value === "" ? "" : parseFloat(value),
                        }));
                      }}
                      onBlur={() => {}}
                      style={{ width: "80px", marginLeft: "10px" }}
                    />
                  </div>
                  <div>
                    <label>Expected Fatalities Per Successful Attempt:</label>
                    <input
                      type="number"
                      value={inputParams.expectedFatalitiesPerSuccessfulAttempt}
                      onChange={(e) => {
                        const value = e.target.value;
                        setInputParams((prev) => ({
                          ...prev,
                          expectedFatalitiesPerSuccessfulAttempt:
                            value === "" ? "" : parseFloat(value),
                        }));
                      }}
                      onBlur={() => {}}
                      style={{ width: "120px", marginLeft: "10px" }}
                    />
                  </div>
                  <div>
                    <label>Queries Per Month:</label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={inputParams.queriesAttackerExecutesPerMonth}
                      onChange={(e) => {
                        const value = e.target.value;
                        setInputParams((prev) => ({
                          ...prev,
                          queriesAttackerExecutesPerMonth:
                            value === "" ? "" : parseInt(value, 10),
                        }));
                      }}
                      onBlur={() => {}}
                      style={{ width: "80px", marginLeft: "10px" }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <EffortCDF
              onChange={(params) => {
                setInputParams(prev => ({
                  ...prev,
                  effortCDF: generateCDFData(params)
                }));
              }}
            />
            {/* Main Columns */}
            <div
              style={{ display: "flex", gap: "40px", justifyContent: "center" }}
            >
              {/* Left Column */}
              <div
                style={{
                  width: "400px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "30px",
                }}
              >
                <h2
                  style={{
                    margin: "0 0 20px 0",
                    width: "100%",
                    maxWidth: "500px",
                    textAlign: "center",
                  }}
                >
                  Baseline
                </h2>
                <SuccessGivenEffort
                  onChange={(params) => {
                    setBaselineTextFields(params);
                  }}
                  data={inputParams.baselineSuccessProbabilityGivenEffort}
                />

                <ExpectedAnnualFatalities
                  expectedAnnualFatalities={
                    outputParams.baselineExpectedAnnualFatalities
                  }
                />
              </div>

              {/* Right Column */}
              <div
                style={{
                  width: "400px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "30px",
                }}
              >
                <h2
                  style={{
                    margin: "0 0 20px 0",
                    width: "100%",
                    maxWidth: "500px",
                    textAlign: "center",
                  }}
                >
                  Pre-Mitigation Deployment
                </h2>
                <SuccessGivenEffort
                  onChange={(params) => {
                    setPreMitigationTextFields(params);
                  }}
                  data={inputParams.preMitigationSuccessProbabilityGivenEffort}
                />

                <div style={{ textAlign: "center", width: "100%" }}>
                  <ExpectedAnnualFatalities
                    expectedAnnualFatalities={
                      outputParams.preMitigationExpectedAnnualFatalities
                    }
                  />
                </div>
              </div>

              {/* Query Time Plot */}
              <div
                style={{
                  width: "400px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "30px",
                }}
              >
                <h2
                  style={{
                    margin: "0 0 20px 0",
                    width: "100%",
                    maxWidth: "500px",
                    textAlign: "center",
                  }}
                >
                  Post mitigation
                </h2>

                <QueriesVsTimeWithBans
                  timeToExecuteQueries={inputParams.timeToExecuteQueries}
                  bansGivenQueries={inputParams.bansVsQueries}
                  timeLostGivenBans={inputParams.timeLostToBans}
                />

                <QueriesVsTime
                  queriesPerMonth={inputParams.queriesAttackerExecutesPerMonth}
                  onMouseUp={(data) => {
                    // Get all time points at once using the efficient version
                    const timeForQueries = fitQueriesCurve(data);
                    const baselineCurve =
                      generateCurvePoints(baselineTextFields);
                    const preMitigationCurve = generateCurvePoints(
                      preMitigationTextFields
                    );

                    const updatedParams = {
                      ...inputParams,
                      timeToExecuteQueries: timeForQueries,
                      baselineSuccessProbabilityGivenEffort: baselineCurve,
                      preMitigationSuccessProbabilityGivenEffort:
                        preMitigationCurve,
                    };

                    setInputParams(updatedParams);
                    try {
                      const newOutputParams = runModel(updatedParams);
                      setOutputParams(newOutputParams);
                    } catch (e) {
                      setError({ message: e.message, stack: e.stack });
                    }
                  }}
                />

                <ComparisonSuccessGivenEffort
                  data={
                    outputParams.postMitigationSuccessProbabilityGivenEffort
                  }
                  readOnly={true}
                  title="Success Probability Comparison"
                  submittedValues={preMitigationTextFields}
                />
                <BansVsQueries
                  queriesPerMonth={inputParams.queriesAttackerExecutesPerMonth}
                  onMouseUp={(data) => {
                    // get the full ban curve
                    const banCurve = getBanCurve(data);
                    const bansVsQueries = getBansForQueries(data);
                    console.log("ban vs queries", bansVsQueries);
                    setInputParams((prev) => ({
                      ...prev,
                      banCurve: banCurve,
                      bansVsQueries: bansVsQueries,
                    }));

                  }}
                />
                <TimeLostToBans
                  onMouseUp={(data) => {
                    console.log("time lost", data);
                    const timeLostTobans = getTimeLostGivenBans(data);
                    setInputParams((prev) => ({
                      ...prev,
                      timeLostToBans: timeLostTobans,
                    }));
                  }}
                />
              </div>
            </div>

            {error.message && (
              <div
                style={{
                  color: "red",
                  textAlign: "left",
                  marginTop: "20px",
                  padding: "20px",
                  backgroundColor: "#ffebee",
                  borderRadius: "4px",
                  maxWidth: "800px",
                  margin: "20px auto",
                }}
              >
                <div style={{ fontWeight: "bold", marginBottom: "10px" }}>
                  {error.message}
                </div>
                {error.stack && (
                  <pre
                    style={{
                      whiteSpace: "pre-wrap",
                      fontSize: "12px",
                      backgroundColor: "#fff",
                      padding: "10px",
                      borderRadius: "4px",
                      overflow: "auto",
                      maxHeight: "200px",
                    }}
                  >
                    {error.stack}
                  </pre>
                )}
              </div>
            )}


          </div>
        </form>
      </div>
    </div>
  );
}

export default App;
