import React, { useState, useEffect, useRef } from "react";
import "./App.css";
import EffortCDF from "./components/EffortCDF.jsx";
import QueriesVsTime from "./components/QueriesVsTime.jsx";
import { getTimeForQueries } from "./components/QueriesVsTime.jsx";
import SuccessGivenEffort from "./components/SuccessGivenEffort.jsx";
import ExpectedAnnualFatalities from "./components/ExpectedAnnualFatalities.jsx";
import { generateCurvePoints } from "./utils/curves.js";
import {
  runModel,
  getPostMitigationSuccessProbabilityGivenEffort,
} from "./utils/model.js";

function App() {
  const [error, setError] = useState("");
  const queriesPerMonth = 30;

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
    expectedFatalitiesPerSuccessfulAttempt: 1000000,
    expectedAnnualAttempts: 1000,
    queriesAttackerExecutesPerMonth: 30,
  });

  // Initialize data on mount
  useEffect(() => {
    const defaultPoints = [
      { time: 1, queries: 0 },
      { time: 90, queries: 450 },
      { time: 270, queries: 750 },
    ];

    setInputParams({
      baselineSuccessProbabilityGivenEffort: generateCurvePoints(baselineTextFields),
      preMitigationSuccessProbabilityGivenEffort: generateCurvePoints(preMitigationTextFields),
      timeToExecuteQueries: Array.from({ length: 1000 }, (_, i) => getTimeForQueries(i, defaultPoints)),
      expectedFatalitiesPerSuccessfulAttempt: 1000000,
      expectedAnnualAttempts: 1000,
      queriesAttackerExecutesPerMonth: 30,
    });
  }, []);

  // Output parameters
  const [outputParams, setOutputParams] = useState({
    postMitigationSuccessProbabilityGivenEffort: [],
    baselineExpectedAnnualFatalities: null,
    preMitigationExpectedAnnualFatalities: null,
    postMitigationExpectedAnnualFatalities: null,
  });




  // Initialize input parameters from text data
  const computeInputParamsFromTextFields = () => {
    try {
      setInputParams({
        ...inputParams,
        baselineSuccessProbabilityGivenEffort:
          generateCurvePoints(baselineTextFields),
        preMitigationSuccessProbabilityGivenEffort: generateCurvePoints(
          preMitigationTextFields
        ),
      });
    } catch (e) {
      setError(e.message);
      return null;
    }
  };

  // Wrapper for runModel that handles errors
  const runModelWithErrorHandling = (params) => {
    try {
      return runModel(params);
    } catch (e) {
      setError(e.message);
      return null;
    }
  };

  // Function to refresh the page state
  const refreshPage = () => {
    try {
      computeInputParamsFromTextFields();
      // console.log(inputParams.timeToExecuteQueries);
      const newOutputParams = runModelWithErrorHandling(inputParams);
      if (!newOutputParams) return;

      setOutputParams(newOutputParams);
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
            refreshPage();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && e.target.tagName === "INPUT") {
              e.preventDefault();
              refreshPage();
            }
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
                        setInputParams((prev) => ({
                          ...prev,
                          expectedAnnualAttempts: parseFloat(e.target.value),
                        }));
                        refreshPage();
                      }}
                      style={{ width: "80px", marginLeft: "10px" }}
                    />
                  </div>
                  <div>
                    <label>Expected Fatalities Per Successful Attempt:</label>
                    <input
                      type="number"
                      value={inputParams.expectedFatalitiesPerSuccessfulAttempt}
                      onChange={(e) => {
                        setInputParams((prev) => ({
                          ...prev,
                          expectedFatalitiesPerSuccessfulAttempt: parseFloat(
                            e.target.value
                          ),
                        }));
                        refreshPage();
                      }}
                      style={{ width: "120px", marginLeft: "10px" }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <EffortCDF
              onChange={(params) => {
                setPreMitigationTextFields((prev) => ({
                  ...prev,
                  ...params,
                }));
                refreshPage();
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
                    setBaselineTextFields((prev) => ({
                      ...prev,
                      ...params,
                    }));
                    refreshPage();
                  }}
                />

                <ExpectedAnnualFatalities
                  successProbabilityGivenEffort={
                    inputParams.baselineSuccessProbabilityGivenEffort
                  }
                  expectedAnnualAttempts={inputParams.expectedAnnualAttempts}
                  expectedFatalitiesPerSuccessfulAttempt={
                    inputParams.expectedFatalitiesPerSuccessfulAttempt
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
                    setPreMitigationTextFields((prev) => ({
                      ...prev,
                      ...params,
                    }));
                    refreshPage();
                  }}
                />

                <div style={{ textAlign: "center", width: "100%" }}>
                  <h3 style={{ margin: "0 0 10px 0" }}>
                    Expected Annual Fatalities
                  </h3>
                  <ExpectedAnnualFatalities
                    successProbabilityGivenEffort={
                      outputParams.postMitigationSuccessProbabilityGivenEffort
                    }
                    expectedAnnualAttempts={inputParams.expectedAnnualAttempts}
                    expectedFatalitiesPerSuccessfulAttempt={
                      inputParams.expectedFatalitiesPerSuccessfulAttempt
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

                <QueriesVsTime
                  onMouseUp={(data) => {
                    const timeForQueries = Array.from(
                      { length: 1000 },
                      (_, i) => getTimeForQueries(i, data)
                    );
                    const baselineCurve = generateCurvePoints(baselineTextFields);
                    const preMitigationCurve = generateCurvePoints(preMitigationTextFields);
                    
                    const updatedParams = {
                      ...inputParams,
                      timeToExecuteQueries: timeForQueries,
                      baselineSuccessProbabilityGivenEffort: baselineCurve,
                      preMitigationSuccessProbabilityGivenEffort: preMitigationCurve
                    };
                    
                    setInputParams(updatedParams);
                    const newOutputParams = runModelWithErrorHandling(updatedParams);
                    if (newOutputParams) {
                      setOutputParams(newOutputParams);
                    }
                  }}
                />

                <SuccessGivenEffort
                  data={
                    outputParams.postMitigationSuccessProbabilityGivenEffort
                  }
                  readOnly={true}
                  title="Post-Mitigation Success Probability"
                />
              </div>
            </div>

            {error && (
              <div
                style={{ color: "red", textAlign: "center", marginTop: "20px" }}
              >
                {error}
              </div>
            )}

            <div
              style={{
                display: "flex",
                justifyContent: "center",
                marginTop: "40px",
                marginBottom: "20px",
              }}
            >
              <button
                onClick={() => refreshPage()}
                type="button"
                style={{
                  padding: "12px 24px",
                  backgroundColor: "#4CAF50",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                  width: "200px",
                  fontSize: "16px",
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
