const ParameterSelector = ({ inputParams, setInputParams, refreshPage }) => {
  return (
    <div
        style={{
        display: "flex",
        gap: "20px",
        justifyContent: "flex-start",
        flexWrap: "wrap",
        backgroundColor: "#FBFBFB",
        borderRadius: "8px",
        padding: "20px",
        margin: "clamp(5px, 2vw, 10px)",
        boxShadow: "0 2px 4px rgba(0, 0, 0, 0.05)",
        }}
    >
        <div style={{ width: "clamp(280px, 100%, 320px)" }}>
        <div
            style={{
            display: "flex",
            flexDirection: "column",
            gap: "15px",
            }}
        >
            <div
            style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "15px",
                minWidth: 0
            }}
            >
            <label style={{ fontSize: "12px", fontWeight: "500", color: "#1a2a3a", width: "220px", textAlign: "left", display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ whiteSpace: "nowrap" }}>
              Expected Annual Attempts
              </span>
              <div className="info-icon-tooltip" style={{ flexShrink: 0 }}>
                i
                <span className="tooltip">
                The number of annual novice attempts to cause a large-scale harm. An "attempt" must involve at least two weeks of earnest effort.
                </span>
              </div>
            </label>
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
                onBlur={() => refreshPage()}
                style={{
                  width: "100px",
                  padding: "6px 8px",
                  fontSize: "12px",
                  border: "2px solid #e8e8e8",
                  borderRadius: "6px",
                  outline: "none",
                  backgroundColor: "white",
                  color: "#1a2a3a",
                  transition: "all 0.2s ease",
                  cursor: "pointer",
                  boxShadow: "0 2px 4px rgba(194, 226, 249, 0.1)"
                }}
            />
            </div>
            <div
            style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "15px",
                minWidth: 0
            }}
            >
            <label style={{ fontSize: "12px", fontWeight: "500", color: "#1a2a3a", width: "220px", textAlign: "left", display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ whiteSpace: "nowrap" }}>
              Expected Harm Per Success
              </span>
              <div className="info-icon-tooltip" style={{ flexShrink: 0 }}>
                i
                <span className="tooltip">
                  The expected harm if a novice attempt succeeds (e.g. financial damage or lives lost).
                </span>
              </div>
            </label>
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
                onBlur={() => refreshPage()}
                style={{
                  width: "100px",
                  padding: "6px 8px",
                  fontSize: "12px",
                  border: "2px solid #e8e8e8",
                  borderRadius: "6px",
                  outline: "none",
                  backgroundColor: "white",
                  color: "#1a2a3a",
                  transition: "all 0.2s ease",
                  cursor: "pointer",
                  boxShadow: "0 2px 4px rgba(194, 226, 249, 0.1)"
                }}
            />
            </div>
            <div
            style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "15px",
                minWidth: 0
            }}
            >
            <label style={{ fontSize: "12px", fontWeight: "500", color: "#1a2a3a", width: "220px", textAlign: "left", display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ whiteSpace: "nowrap" }}>
              Queries Per Month
              </span>
              <div className="info-icon-tooltip" style={{ flexShrink: 0 }}>
                i
                <span className="tooltip">
                  The number of queries to the AI assistant that a novice misuse actor would benefit from per month if given access to the unmitigated AI assistant. We assume that the benefit of executing queries above this frequency quickly trails off.
                </span>
              </div>
            </label>
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
                    value === "" ? "" : parseFloat(value),
                }));
                }}
                onBlur={() => refreshPage()}
                style={{
                  width: "100px",
                  padding: "6px 8px",
                  fontSize: "12px",
                  border: "2px solid #e8e8e8",
                  borderRadius: "6px",
                  outline: "none",
                  backgroundColor: "white",
                  color: "#1a2a3a",
                  transition: "all 0.2s ease",
                  cursor: "pointer",
                  boxShadow: "0 2px 4px rgba(194, 226, 249, 0.1)"
                }}
            />
            </div>
        </div>
        </div>
    </div>
  );
};

export default ParameterSelector;
