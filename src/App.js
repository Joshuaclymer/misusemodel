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
import ParameterSelector from "./components/ParameterSelector.jsx";
import BlueBox from "./components/BlueBox.jsx";
import OrangeBox from "./components/OrangeBox.jsx";
import PurpleBox from "./components/PurpleBox.jsx";
import Card from "./components/Card.jsx";

import {
  runModel,
  getPostMitigationSuccessProbabilityGivenEffort,
} from "./utils/model.js";

// Maximum time in months for pre-mitigation and baseline curves
export const maxTimeMonths = 60; // 60 months

const useWindowSize = () => {
  const [windowSize, setWindowSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  useEffect(() => {
    const handleResize = () => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return windowSize;
};

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
  { time: 5, queries: 4 }, // First control point
  { time: 15, queries: 12 }, // Middle point
  { time: 45, queries: 16 }, // End point
];

const initialEffortPoints = {
  effortanch1: 90,
  effortanch2: 95,
  effortanch3: 98,
  effortanch4: 100,
};

function App() {
  const { width } = useWindowSize();
  const [error, setError] = useState({ message: "", stack: "" });

  const [baselineTextFields, setBaselineTextFields] = useState({
    successanch1: 0.1,
    successanch2: 3,
    successanch3: 10,
  });

  const [preMitigationTextFields, setPreMitigationTextFields] = useState({
    successanch1: 0.1,
    successanch2: 3,
    successanch3: 20,
  });

  // Initialize input parameters with computed values right away
  const [inputParams, setInputParams] = useState({
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
  });

  // Update input params when text fields change
  useEffect(() => {
    computeInputParamsFromTextFields();
  }, [baselineTextFields, preMitigationTextFields]);

  // Output parameters
  const getOutputParams = () => {
    return runModel(inputParams);
  };

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
      setError({ message: e.message, stack: e.stack });
      return null;
    }
  };

  // Function to refresh the page state
  const refreshPage = () => {
    // try {
    //   computeInputParamsFromTextFields();
    //   // console.log(inputParams.timeToExecuteQueries);
    //   const newOutputParams = runModelWithErrorHandling(inputParams);
    //   console.log("new output params", newOutputParams);
    //   if (!newOutputParams) return;
    //   setOutputParams(newOutputParams);
    //   setError({ message: "", stack: "" });
    // } catch (e) {
    //   setError({ message: e.message, stack: e.stack });
    // }
  };

  return (
    <div className="App">
      <div>
        <h1 style={{ textAlign: "center", margin: "40px" }}>
          AI biological misuse risk model
        </h1>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            refreshPage();
          }}
        >
          <div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                width: "100%",
                // padding: "clamp(0px, 2vw, 20px)"
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  maxWidth: "1400px",
                  width: "100%",
                  // margin: "clamp(20px, 5vw, 80px) auto",
                  gap: width < 1200 ? "0px" : "40px",
                }}
              >
                <BlueBox>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "center",
                      width: "100%",
                    }}
                  >
                    <h3
                      style={{
                        margin: "0px",
                        marginTop: "30px",
                        marginBottom: "10px",
                        color: "#113A58",
                      }}
                    >
                      Evidence from expert surveys
                    </h3>
                  </div>
                  <div
                    className="responsive-container"
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      minHeight: "600px",
                      backgroundColor: "#e3f2fd",
                      gap: "40px",
                      padding: "20px",
                      width: "100%",
                      maxWidth: "1400px",
                      margin: "0 auto",
                    }}
                  >
                    <SuccessGivenEffort
                      onChange={(params) => {
                        setBaselineTextFields(params);
                      }}
                      data={inputParams.baselineSuccessProbabilityGivenEffort}
                      initialValues={baselineTextFields}
                      baselineValues={baselineTextFields}
                      preMitigationValues={preMitigationTextFields}
                    />
                    <EffortCDF
                      onChange={(params) => {
                        setInputParams((prev) => ({
                          ...prev,
                          effortCDF: generateCDFData(params),
                        }));
                        refreshPage();
                      }}
                    />

                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        flex: 1,
                        minHeight: "500px",
                        gap: "20px",
                        width: "100%",
                        // margin: "0 auto"
                      }}
                    >
                      <ParameterSelector
                        inputParams={inputParams}
                        setInputParams={setInputParams}
                        refreshPage={refreshPage}
                      />
                      <ExpectedAnnualFatalities
                        titleWord="Baseline"
                        titleColor="#2ecc71"
                        expectedAnnualFatalities={
                          getOutputParams().baselineExpectedAnnualFatalities
                        }
                      />
                    </div>
                  </div>
                </BlueBox>
                {/* Section 2 */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: width < 1200 ? "column" : "row",
                    alignItems: "stretch",
                    justifyContent: "center",
                    width: "100%",
                    minHeight: width < 1200 ? "auto" : "800px",
                  }}
                >
                  <OrangeBox>
                    <div
                      style={{
                        flexDirection: "column",
                        justifyContent: "flex-start",
                        alignItems: "center",
                        width: "100%",
                        flex: 1,
                        // gap: "40px",
                        marginTop: "30px",
                        marginBottom: "30px",
                        // padding: "50px",
                      }}
                    >
                      <h3
                        style={{
                          margin: 0,
                          color: "#765117",
                        }}
                      >
                        Evidence from capability evaluations + experts
                      </h3>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        height: "100%",
                        // margin: "0 auto"
                      }}
                    >
                      <SuccessGivenEffort
                        title="Pre-Mitigation success probability"
                        onChange={(params) => {
                          setPreMitigationTextFields(params);
                          // refreshPage();
                        }}
                        data={
                          inputParams.preMitigationSuccessProbabilityGivenEffort
                        }
                        color="#e74c3c"
                        initialValues={preMitigationTextFields}
                        baselineValues={baselineTextFields}
                        preMitigationValues={preMitigationTextFields}
                      />
                      <ExpectedAnnualFatalities
                        titleWord="Pre-Mitigation"
                        titleColor="#e74c3c"
                        expectedAnnualFatalities={
                          getOutputParams()
                            .preMitigationExpectedAnnualFatalities
                        }
                      />
                    </div>
                  </OrangeBox>
                  <PurpleBox>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "flex-start",
                        alignItems: "center",
                        width: "100%",
                        height: "100%",
                        // gap: "40px",
                        // padding: "40px",
                      }}
                    >
                      <h3
                        style={{
                          marginTop: "30px",
                          marginBottom: "30px",
                          color: "#59095E",
                        }}
                      >
                        Evidence from safeguards evaluations
                      </h3>
                    </div>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: width < 1200 ? "1fr" : "1fr 1fr",
                        gridTemplateRows: width < 1200 ? "1fr" : "1fr 1fr",
                        gap: "0px",
                        // width: "100%",
                        height: "100%",
                        padding: "0px",
                      }}
                    >
                      <Card>
                        <QueriesVsTime
                          queriesPerMonth={
                            inputParams.queriesAttackerExecutesPerMonth
                          }
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
                              baselineSuccessProbabilityGivenEffort:
                                baselineCurve,
                              preMitigationSuccessProbabilityGivenEffort:
                                preMitigationCurve,
                            };
                            setInputParams(updatedParams);
                          }}
                        />
                      </Card>
                      <Card>
                        <QueriesVsTimeWithBans
                          timeToExecuteQueries={
                            inputParams.timeToExecuteQueries
                          }
                          bansGivenQueries={inputParams.bansVsQueries}
                          timeLostGivenBans={inputParams.timeLostToBans}
                        />
                      </Card>
                      <Card>
                        <BansVsQueries
                          queriesPerMonth={
                            inputParams.queriesAttackerExecutesPerMonth
                          }
                          onMouseUp={(data) => {
                            // get the full ban curve
                            const bansVsQueries = getBansForQueries(data);
                            setInputParams((prev) => ({
                              ...prev,
                              bansVsQueries: bansVsQueries,
                            }));
                          }}
                        />
                      </Card>
                      <Card>
                        <TimeLostToBans
                          onMouseUp={(data) => {
                            const timeLostTobans = getTimeLostGivenBans(data);
                            setInputParams((prev) => ({
                              ...prev,
                              timeLostToBans: timeLostTobans,
                            }));
                          }}
                        />
                      </Card>
                    </div>
                    <ExpectedAnnualFatalities
                      titleWord="Post-Mitigation"
                      titleColor="#3498DB"
                      expectedAnnualFatalities={
                        getOutputParams().postMitigationExpectedAnnualFatalities
                      }
                    />
                  </PurpleBox>
                </div>
                <div>
                  <div style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "100%",
                    gap: "30px",
                  }}>
                    <h2
                      style={{
                        marginTop: "20px",
                        marginBottom: "40px",
                        width: "100%",
                        maxWidth: "500px",
                        textAlign: "center",
                      }}
                    >
                     Predictions 
                    </h2>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: width < 1200 ? "column" : "row",
                      justifyContent: "center",
                      alignItems: width < 1200 ? "center" : "flex-start",
                      width: "100%",
                      marginBottom: "100px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: width < 1200 ? "center" : "flex-end",
                        justifyContent: "space-between",
                        marginRight: width < 1200 ? "0px" : "50px",
                        gap: "30px",
                        width: "100%",
                      }}
                    >
                      <ExpectedAnnualFatalities
                        titleWord="Baseline"
                        titleColor="#2ecc71"
                        width = {width < 1200 ? "100%" : "600px"}
                        expectedAnnualFatalities={
                          getOutputParams().baselineExpectedAnnualFatalities
                        }
                      />
                      <ExpectedAnnualFatalities
                        titleWord="Pre-Mitigation"
                        titleColor="#e74c3c"
                        width = {width < 1200 ? "100%" : "600px"}
                        expectedAnnualFatalities={
                          getOutputParams()
                            .preMitigationExpectedAnnualFatalities
                        }
                      />
                      <ExpectedAnnualFatalities
                        titleWord="Post-Mitigation"
                        titleColor="#3498DB"
                        width = {width < 1200 ? "100%" : "600px"}
                        expectedAnnualFatalities={
                          getOutputParams()
                            .postMitigationExpectedAnnualFatalities
                        }
                        baseline={
                          getOutputParams().baselineExpectedAnnualFatalities
                        }
                      />
                    </div>

                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        marginLeft: width < 1200 ? "0px" : "50px",
                        alignItems: width < 1200 ? "center" : "flex-start",
                        justifyContent: "center",
                        gap: "30px",
                        width: "100%",
                      }}
                    >
                    <Card>
                      <ComparisonSuccessGivenEffort
                        data={
                          getOutputParams()
                            .postMitigationSuccessProbabilityGivenEffort
                        }
                        baselineData={
                          inputParams.baselineSuccessProbabilityGivenEffort
                        }
                        readOnly={true}
                        title="Success Probability Comparison"
                        submittedValues={preMitigationTextFields}
                      />
                    </Card>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </form>
      </div>
                {/* Footer */}
                <div style={{width: "100%", textAlign: "center", paddingTop: "40px", paddingBottom: "40px", backgroundColor: "#FBFBFB"}}>
                  <p>This site was created by Joshua Clymer for the research paper "A Safety Case Sketch for Evaluating Safeguards Against AI-Enabled Bioterrorism." </p>
                </div>
    </div>
  );
}

export default App;
