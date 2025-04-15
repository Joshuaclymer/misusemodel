import React, { useState, useEffect, useRef } from "react";
import PasswordPage from "./components/PasswordPage.jsx";
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
import { ArcherContainer, ArcherElement } from "react-archer";
import SimulationPlot from "./components/SimulationPlot.jsx";

import {
  runModel,
  getPostMitigationSuccessProbabilityGivenEffort,
} from "./utils/model.js";

// Maximum time in months for pre-mitigation and baseline curves
export const maxTimeMonths = 48; 
export const ANCHOR_MONTHS = [2, 6, 24];

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
  effortanch2: 98,
  effortanch3: 100,
  effortanch4: 100,
};

function App() {
  const { width } = useWindowSize();
  const [error, setError] = useState({ message: "", stack: "" });
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const [baselineTextFields, setBaselineTextFields] = useState({
    successanch1: 0.1,
    successanch2: 3,
    successanch3: 10,
  });

  const [preMitigationTextFields, setPreMitigationTextFields] = useState({
    successanch1: 0.4,
    successanch2: 10,
    successanch3: 11,
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
    expectedAnnualAttempts: 10,
    effortCDF: generateCDFData(initialEffortPoints),
    queriesAttackerExecutesPerMonth: 30,
    jailbreakTime: maxTimeMonths / 2, // Default jailbreak time (months)
    unacceptableRiskContribution: 30000, // Default unacceptable risk contribution (annual fatalities)
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

  let showArrows = width >= 1200;
  // let showArrows = true;

  if (!isAuthenticated) {
    return <PasswordPage onCorrectPassword={() => setIsAuthenticated(true)} />;
  }

  return (
    <div className="App">
      <div>
        <h1 style={{ textAlign: "center", margin: "40px" }}>
          Interactive AI misuse risk model
        </h1>
        <div style={{ 
          textAlign: "center", 
          maxWidth: "600px", 
          width: "90%", 
          color: "grey", 
          display: "inline-block", 
          margin: "0 auto 40px"
        }}>
          <p>The following is an interactive model of AI misuse risks described in the research paper "An Example Safety Case for Safeguards Against Misuse." The model leverages evidence from <span style={{ fontWeight: "bold" , color: "#1A4F76"}}>expert surveys</span>, <span style={{ fontWeight: "bold" , color: "#AF7B29"}}>capability evaluations</span>, and <span style={{ fontWeight: "bold" , color: "#59095E"}}>safeguards evaluations</span> to estimate the annual expected harms caused by novice actors with the help of a particular AI assistant. 
          </p>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            refreshPage();
          }}
        >
          <div>
            <ArcherContainer strokeColor="#666">
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
                          color: "#1A4F76",
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
                      <ArcherElement
                        id="effort-baseline-success-arrow"
                        relations={[
                          {
                            targetId: "expected-fatalities-target",
                            targetAnchor: "left",
                            sourceAnchor: "right",
                            style: {
                              strokeColor: showArrows ? "#666" : "transparent",
                              strokeWidth: 1,
                            },
                          },
                        ]}
                      >
                        <div>
                          <SuccessGivenEffort
                            onChange={(params) => {
                              setBaselineTextFields(params);
                            }}
                            data={
                              inputParams.baselineSuccessProbabilityGivenEffort
                            }
                            initialValues={baselineTextFields}
                            baselineValues={baselineTextFields}
                            preMitigationValues={preMitigationTextFields}
                            tooltipDescription="The distribution below indicates the probability that a novice 'attempt' to cause a large-scale harm will succeed given varying levels of time spent, where an 'attempt' must involve at least two weeks of earnest effort. This curve assumes conditions *prior to the deployment of the AI assistant in question.*"
                          />
                        </div>
                      </ArcherElement>
                      <ArcherElement
                        id="effort-cdf-arrow"
                        relations={[
                          {
                            targetId: "expected-fatalities-target",
                            targetAnchor: "left",
                            sourceAnchor: "right",
                            style: {
                              strokeColor: showArrows ? "#666" : "transparent",
                              strokeWidth: 1,
                            },
                          },
                          {
                            targetId: "expected-fatalities-pre-mitigation",
                            targetAnchor: "right",
                            sourceAnchor: "bottom",
                            style: {
                              strokeColor: showArrows ? "#666" : "transparent",
                              strokeWidth: 1,
                            },
                          },
                          {
                            targetId: "expected-fatalities-post-mitigation",
                            targetAnchor: "left",
                            sourceAnchor: "bottom",
                            style: {
                              strokeColor: showArrows ? "#666" : "transparent",
                              strokeWidth: 1,
                            },
                          }
                        ]}
                      >
                        <div>
                          <EffortCDF
                            onChange={(params) => {
                              setInputParams((prev) => ({
                                ...prev,
                                effortCDF: generateCDFData(params),
                              }));
                              refreshPage();
                            }}
                          />
                        </div>
                      </ArcherElement>

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
                        <ArcherElement
                          id="parameter-selector-arrow"
                          relations={[
                            {
                              targetId: "expected-fatalities-target",
                              targetAnchor: "top",
                              sourceAnchor: "bottom",
                              style: {
                                strokeColor: showArrows
                                  ? "#666"
                                  : "transparent",
                                strokeWidth: 1,
                              },
                            },
                            {
                              targetId: "expected-fatalities-pre-mitigation",
                              targetAnchor: "right",
                              sourceAnchor: "left",
                              style: {
                                strokeColor: showArrows
                                  ? "#666"
                                  : "transparent",
                                strokeWidth: 1,
                              },
                            },
                            {
                              targetId: "expected-fatalities-post-mitigation",
                              targetAnchor: "right",
                              sourceAnchor: "right",
                              style: {
                                strokeColor: showArrows
                                  ? "#666"
                                  : "transparent",
                                strokeWidth: 1,
                              },
                            },
                          ]}
                        >
                          <div>
                            <ParameterSelector
                              inputParams={inputParams}
                              setInputParams={setInputParams}
                              refreshPage={refreshPage}
                            />
                          </div>
                        </ArcherElement>
                        <ArcherElement id="expected-fatalities-target">
                          <div>
                            <ExpectedAnnualFatalities
                              titleWord="Baseline"
                              titleColor="#2ecc71"
                              expectedAnnualFatalities={
                                getOutputParams()
                                  .baselineExpectedAnnualFatalities
                              }
                            />
                          </div>
                        </ArcherElement>
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
                      // minHeight: width < 1200 ? "auto" : "800px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        width: "100%",
                      }}
                    >
                      <OrangeBox>
                        <div
                          style={{
                            flexDirection: "column",
                            justifyContent: "flex-start",
                            alignItems: "center",
                            width: "100%",
                            // flex: 1,
                            // gap: "40px",
                            marginTop: "30px",
                            marginBottom: "30px",
                            // padding: "50px",
                          }}
                        >
                          <h3
                            style={{
                              margin: 0,
                              color: "#AF7B29",
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
                          <ArcherElement
                            id="success-pre-mitigation"
                            relations={[
                              {
                                targetId: "expected-fatalities-pre-mitigation",
                                targetAnchor: "top",
                                sourceAnchor: "bottom",
                                style: {
                                  strokeColor: showArrows
                                    ? "#666"
                                    : "transparent",
                                  strokeWidth: 1,
                                },
                              },
                              {
                                targetId: "success-probability-comparison",
                                targetAnchor: "left",
                                sourceAnchor: "right",
                                style: {
                                  strokeColor: showArrows
                                    ? "#666"
                                    : "transparent",
                                  strokeWidth: 1,
                                },
                              }
                            ]}
                          >
                            <div>
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
                                tooltipDescription="The distribution below indicates the probability that a novice 'attempt' to cause a large-scale harm will succeed given varying levels of time spent, where an 'attempt' must involve at least two weeks of earnest effort. This curve assumes conditions where the AI assistant in question is deployed *without safeguards.*"
                              />
                            </div>
                          </ArcherElement>
                          <div style={{ height: "40px" }}></div>
                          <ArcherElement id="expected-fatalities-pre-mitigation">
                            <div>
                              <ExpectedAnnualFatalities
                                titleWord="Pre-Mitigation"
                                titleColor="#e74c3c"
                                expectedAnnualFatalities={
                                  getOutputParams()
                                    .preMitigationExpectedAnnualFatalities
                                }
                              />
                            </div>
                          </ArcherElement>
                        </div>
                      </OrangeBox>

                      <div
                        style={{
                          width: "100%",
                          height: "100%",
                          backgroundColor: "#F6F6F6",
                          border: "5px solid #D3D3D3",
                          boxSizing: "border-box",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            flexDirection: width < 1200 ? "column" : "row",
                            justifyContent: "center",
                            alignItems: width < 1200 ? "center" : "flex-start",
                            width: "100%",
                            // marginBottom: "100px",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "center",
                              justifyContent: "space-between",
                              // marginRight: width < 1200 ? "0px" : "50px",
                              gap: "30px",
                              width: "100%",
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                justifyContent: "center",
                                width: "100%",
                                gap: "30px",
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
                                Summary of predictions
                              </h3>
                            </div>
                            <ExpectedAnnualFatalities
                              titleWord="Baseline"
                              titleColor="#2ecc71"
                              expectedAnnualFatalities={
                                getOutputParams()
                                  .baselineExpectedAnnualFatalities
                              }
                            />
                            <ExpectedAnnualFatalities
                              titleWord="Pre-Mitigation"
                              titleColor="#e74c3c"
                              expectedAnnualFatalities={
                                getOutputParams()
                                  .preMitigationExpectedAnnualFatalities
                              }
                            />
                            <ExpectedAnnualFatalities
                              titleWord="Post-Mitigation"
                              titleColor="#3498DB"
                              expectedAnnualFatalities={
                                getOutputParams()
                                  .postMitigationExpectedAnnualFatalities
                              }
                              baseline={
                                getOutputParams()
                                  .baselineExpectedAnnualFatalities
                              }

                              unacceptableRiskContribution={
                                inputParams.unacceptableRiskContribution
                              }
                            />
                          </div>
                        </div>
                      </div>
                    </div>
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
                          gap: "20px",
                          // width: "100%",
                          height: "100%",
                          padding: "0px",
                        }}
                      >
                        <ArcherElement id="queries-vs-time" relations={[
                          {
                            targetId: "queries-vs-time-with-bans",
                            targetAnchor: "left",
                            sourceAnchor: "right",
                            style: {
                              strokeColor: showArrows
                                ? "#666"
                                : "transparent",
                              strokeWidth: 1,
                            },
                          },
                        ]}>
                          <div>
                            <Card>
                              <QueriesVsTime
                                queriesPerMonth={
                                  inputParams.queriesAttackerExecutesPerMonth
                                }
                                tooltipDescription="The results of a safeguards evaluation. A red team tries to obtain responses from an AI assistant to a representative set of misuse queries. The y-axis shows the average number of queries executed by members of the red team as a function of effort expended."
                                onMouseUp={(data) => {
                                  // Get all time points at once using the efficient version
                                  const timeForQueries = fitQueriesCurve(data);
                                  const baselineCurve =
                                    generateCurvePoints(baselineTextFields);
                                  const preMitigationCurve =
                                    generateCurvePoints(
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
                          </div>
                        </ArcherElement>
                        <ArcherElement id="bans-vs-queries" relations={
                          [
                            {
                              targetId: "queries-vs-time-with-bans",
                              targetAnchor: "top",
                              sourceAnchor: "bottom",
                              style: {
                                strokeColor: showArrows
                                  ? "#666"
                                  : "transparent",
                                strokeWidth: 1,
                              },
                            }
                          ]
                        }>
                          <div>
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
                          </div>
                        </ArcherElement>
                        <ArcherElement id="time-lost-to-bans" relations={[
                          {
                            targetId: "queries-vs-time-with-bans",
                            targetAnchor: "left",
                            sourceAnchor: "right",
                            style: {
                              strokeColor: showArrows
                                ? "#666"
                                : "transparent",
                              strokeWidth: 1,
                            },
                          }
                        ]}>
                          <div>
                            <Card>
                              <TimeLostToBans
                                onMouseUp={(data) => {
                                  const timeLostTobans =
                                    getTimeLostGivenBans(data);
                                  setInputParams((prev) => ({
                                    ...prev,
                                    timeLostToBans: timeLostTobans,
                                  }));
                                }}
                              />
                            </Card>
                          </div>
                        </ArcherElement>
                        <ArcherElement id="queries-vs-time-with-bans" relations={[
                          {
                            targetId: "success-probability-comparison",
                            targetAnchor: "top",
                            sourceAnchor: "bottom",
                            style: {
                              strokeColor: showArrows
                                ? "#666"
                                : "transparent",
                              strokeWidth: 1,
                            },
                          },
                        ]}>
                          <div>
                            <Card>
                              <QueriesVsTimeWithBans
                                timeToExecuteQueries={
                                  inputParams.timeToExecuteQueries
                                }
                                bansGivenQueries={inputParams.bansVsQueries}
                                timeLostGivenBans={inputParams.timeLostToBans}
                              />
                            </Card>
                          </div>
                        </ArcherElement>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          marginTop: "30px",
                          marginLeft: width < 1200 ? "0px" : "50px",
                          alignItems: width < 1200 ? "center" : "flex-start",
                          justifyContent: "center",
                          gap: "30px",
                          width: "100%",
                        }}
                      >
                        <ArcherElement id="success-probability-comparison" relations={[
                          {
                            targetId: "expected-fatalities-post-mitigation",
                            targetAnchor: "top",
                            sourceAnchor: "bottom",
                            style: {
                              strokeColor: showArrows
                                ? "#666"
                                : "transparent",
                              strokeWidth: 1,
                            },
                          }
                        ]}>
                          <div>
                            <Card>
                              <ComparisonSuccessGivenEffort
                                postMitigationData={
                                  getOutputParams()
                                    .postMitigationSuccessProbabilityGivenEffort
                                }
                                baselineData={
                                  inputParams.baselineSuccessProbabilityGivenEffort
                                }
                                readOnly={true}
                                title="Success Probability Comparison"
                                preMitigationData={inputParams.preMitigationSuccessProbabilityGivenEffort}
                              />
                            </Card>
                          </div>
                        </ArcherElement>
                      </div>
                      <div style={{ height: "40px" }}></div>
                      <ArcherElement id="expected-fatalities-post-mitigation">
                        <div style={{ display: "flex",justifyContent: "center"}}>
                          <ExpectedAnnualFatalities
                            titleWord="Post-Mitigation"
                            titleColor="#3498DB"
                            expectedAnnualFatalities={
                              getOutputParams()
                                .postMitigationExpectedAnnualFatalities
                            }
                          />
                        </div>
                      </ArcherElement>
                    </PurpleBox>
                  </div>
                  <div style={{maxWidth: "100%", display: "flex", flexDirection: "column", alignItems: "center"}}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", maxWidth: "600px", justifyContent: "center"}}>

                    <h3
                      style={{
                        margin: "0px",
                        marginTop: "30px",
                        marginBottom: "10px",
                        color: "#000000",
                      }}
                    >
                      Estimating how quickly developers need to respond to changing deployment conditions
                    </h3>
                    <p style={{ marginBottom: "0px", color: "grey"}}> We can use this quantitative model to simulate "what-if scenarios" where users identify a way to reliably jailbreak models. How much time do developers have to correct the deployment? </p>

                    </div>
                  </div>

                  <Card>
                    <div style={{ padding: '10px', marginBottom: '10px' }}>
                      <label htmlFor="unacceptableRiskContribution" style={{ marginRight: '10px', fontWeight: 'normal' }}>
                        Unacceptable risk contribution (annual expected harm):
                      </label>
                      <input
                        id="unacceptableRiskContribution"
                        type="number"
                        defaultValue={inputParams.unacceptableRiskContribution}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            const value = parseInt(e.target.value, 10);
                            if (!isNaN(value) && value > 0) {
                              setInputParams(prev => ({
                                ...prev,
                                unacceptableRiskContribution: value
                              }));
                            }
                          }
                        }}
                        style={{
                          padding: '5px',
                          borderRadius: '4px',
                          border: '1px solid #ccc',
                          width: '150px'
                        }}
                      />
                    </div>
                    <SimulationPlot 
                      outputParams={getOutputParams()} 
                      maxTimeMonths={maxTimeMonths} 
                      jailbreakTime={inputParams.jailbreakTime}
                      unacceptableRiskContribution={inputParams.unacceptableRiskContribution}
                      onJailbreakTimeChange={(newTime) => {
                        setInputParams(prev => ({
                          ...prev,
                          jailbreakTime: newTime
                        }));
                      }}
                    />
                  </Card>
                </div>
              </div>
            </ArcherContainer>
          </div>
        </form>
      </div>
      <div style={{ 
        textAlign: "center", 
        maxWidth: "600px", 
        width: "90%", 
        display: "inline-block", 
        margin: "20px auto",
        padding: "0 20px"
      }}>
        <h3>A formal description of the model:</h3>
        <img 
          src="model.png" 
          alt="Model Description" 
          style={{
            width: "100%",
            height: "auto",
            maxWidth: "100%"
          }}
        />
      </div>
      {/* Footer */}
      <div
        style={{
          width: "100%",
          textAlign: "center",
          paddingTop: "40px",
          paddingBottom: "40px",
          backgroundColor: "#FBFBFB",
          color: "grey"
        }}
      >
        <p>
          Joshua Clymer, March 8, 2025.
        </p>
      </div>
    </div>
  );
}

export default App;
