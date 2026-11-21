import { memo } from 'react';
import useLegacyScript from '../../legacy/useLegacyScript';
import init from './legacy';
import './styles.css';

function CreateTestPage() {
  const ref = useLegacyScript(init);
  return (
    <div className="pg pg-create-test" ref={ref}>
      <main>
        <div className="top">
          <label className="search">
            <i className="bi bi-search" style={{ color: "#0a2f78" }}></i>
            <input placeholder="Search students, topics, videos, payments..." />
          </label>
          <div className="r">
            <div className="bell">
              <i className="bi bi-bell"></i>
              <em>
                3
              </em>
            </div>
            <div className="me">
              <div className="av">
                A
              </div>
              <div>
                <b>
                  Admin
                </b>
                Super Admin
              </div>
              <i className="bi bi-chevron-down"></i>
            </div>
          </div>
        </div>
        <div className="wrap">
          <div className="hd">
            <div className="l">
              <i className="bi bi-clipboard2-check-fill"></i>
              <div>
                <h1>
                  <span id="create-flow-title">Create Test</span>
                </h1>
                <p>
                  Set up a new test with schedule, marks, duration, and notifications.
                </p>
              </div>
            </div>
            <button className="back" id="back-to-question-bank" type="button">
              <i className="bi bi-arrow-left"></i>
              Back to Tests
            </button>
          </div>
          <div className="workflow" aria-label="Question management flow">
            <span>1. Products</span>
            <i className="bi bi-chevron-right"></i>
            <span className="active">2. Create Test</span>
            <i className="bi bi-chevron-right"></i>
            <span>3. Create Question</span>
          </div>
          <div className="card">
            <h3>
              <i className="bi bi-card-text"></i>
              Test Details
            </h3>
            <p className="create-test-description" id="create-test-description"></p>
            <div className="g2" style={{ marginBottom: "22px" }}>
              <div>
                <label className="f">
                  Select Product
                  {" "}
                  <s>
                    *
                  </s>
                </label>
                <div className="sl">
                  <select id="test-product">
                    <option value="">
                      Select product
                    </option>
                    <option>
                      FMGE Q-Bank
                    </option>
                    <option>
                      Grand Test Series
                    </option>
                    <option>
                      Subject Wise Test
                    </option>
                    <option>
                      Image Based Test
                    </option>
                  </select>
                  <i className="bi bi-chevron-down"></i>
                </div>
              </div>
              <div>
                <label className="f" id="test-name-label">
                  Test Name
                  {" "}
                  <s>
                    *
                  </s>
                </label>
                <input className="in" id="test-name" placeholder="Enter test name" />
              </div>
            </div>
            <div className="g2 icon-code-grid">
              <div id="test-icon-field">
                <label className="f" htmlFor="test-icon-code">Test Bootstrap Icon</label>
                <div className="bootstrap-icon-input">
                  <i id="test-icon-preview" className="bi bi-clipboard2-check-fill" aria-hidden="true"></i>
                  <input className="in" id="test-icon-code" defaultValue="bi bi-clipboard2-check-fill" placeholder="bi bi-clipboard2-check-fill" autoComplete="off" />
                </div>
                <small className="bootstrap-icon-help">Example: <code>bi bi-clipboard2-check-fill</code></small>
              </div>
            </div>
            <div className="parent-subject-toggle" id="parent-subject-toggle-field">
              <div>
                <b>Add a topic under this test</b>
                <p>When enabled, questions are grouped under the test name and topic.</p>
              </div>
              <label className="sw" htmlFor="use-parent-subject">
                <input id="use-parent-subject" type="checkbox" aria-label="Add a topic under this test" />
                <span></span>
              </label>
            </div>
            <div className="g2" id="test-topic-field" style={{ marginBottom: "22px" }}>
              <div id="test-topic-name-field">
                <label className="f" htmlFor="test-topic">
                  Topic Name
                  <s>*</s>
                </label>
                <input className="in" id="test-topic" placeholder="Enter topic name" />
              </div>
              <div id="topic-icon-field">
                <label className="f" htmlFor="topic-icon-code">Topic Bootstrap Icon</label>
                <div className="bootstrap-icon-input">
                  <i id="topic-icon-preview" className="bi bi-bookmark-fill" aria-hidden="true"></i>
                  <input className="in" id="topic-icon-code" defaultValue="bi bi-bookmark-fill" placeholder="bi bi-bookmark-fill" autoComplete="off" />
                </div>
                <small className="bootstrap-icon-help">Example: <code>bi bi-bookmark-fill</code></small>
              </div>
            </div>
            <div className="g2">
              <div className="dtb">
                <div className="dh">
                  <label className="f">
                    Start Date &amp; Time
                    {" "}
                    <s>
                      *
                    </s>
                  </label>
                  <div className="en">
                    <label className="sw">
                      <input type="checkbox" defaultChecked />
                      <span></span>
                    </label>
                    Enable
                  </div>
                </div>
                <div className="dr">
                  <label>
                    <i className="bi bi-calendar3"></i>
                    <input placeholder="Select date" onFocus={(event) => { (function () { this.type='date' }).call(event.currentTarget); }} onBlur={(event) => { (function () { if(!this.value)this.type='text' }).call(event.currentTarget); }} />
                  </label>
                  <label>
                    <i className="bi bi-clock"></i>
                    <input placeholder="Select time" onFocus={(event) => { (function () { this.type='time' }).call(event.currentTarget); }} onBlur={(event) => { (function () { if(!this.value)this.type='text' }).call(event.currentTarget); }} />
                    <i className="bi bi-chevron-down ch"></i>
                  </label>
                </div>
              </div>
              <div className="dtb">
                <div className="dh">
                  <label className="f">
                    End Date &amp; Time
                    {" "}
                    <s>
                      *
                    </s>
                  </label>
                  <div className="en">
                    <label className="sw">
                      <input type="checkbox" defaultChecked />
                      <span></span>
                    </label>
                    Enable
                  </div>
                </div>
                <div className="dr">
                  <label>
                    <i className="bi bi-calendar3"></i>
                    <input placeholder="Select date" onFocus={(event) => { (function () { this.type='date' }).call(event.currentTarget); }} onBlur={(event) => { (function () { if(!this.value)this.type='text' }).call(event.currentTarget); }} />
                  </label>
                  <label>
                    <i className="bi bi-clock"></i>
                    <input placeholder="Select time" onFocus={(event) => { (function () { this.type='time' }).call(event.currentTarget); }} onBlur={(event) => { (function () { if(!this.value)this.type='text' }).call(event.currentTarget); }} />
                    <i className="bi bi-chevron-down ch"></i>
                  </label>
                </div>
              </div>
            </div>
            <div className="row4">
              <div>
                <label className="f" htmlFor="total-question-count">
                  Questions in Selection
                </label>
                <input className="in" id="total-question-count" type="number" defaultValue="0" readOnly style={{ fontWeight: "600" }} />
              </div>
              <div>
                <label className="f">
                  Total Mark
                  {" "}
                  <s>
                    *
                  </s>
                </label>
                <input className="in" id="total-marks" value="0" readOnly style={{ fontWeight: "600" }} />
              </div>
              <div>
                <div className="scoring-field">
                  <div className="scoring-toggle">
                  <label className="f" htmlFor="marks-enabled">Mark for 1 Question</label>
                  <label className="sw" htmlFor="marks-enabled">
                    <input id="marks-enabled" type="checkbox" defaultChecked aria-label="Enable marks per question" />
                    <span></span>
                  </label>
                  </div>
                  <input className="in" id="marks-per-question" type="number" min="0" step="any" defaultValue="1" style={{ fontWeight: "600" }} />
                </div>
              </div>
              <div>
                <div className="scoring-field">
                  <div className="scoring-toggle">
                  <label className="f" htmlFor="negative-marking-enabled">Negative Mark (for 1 Question)</label>
                  <label className="sw" htmlFor="negative-marking-enabled">
                    <input id="negative-marking-enabled" type="checkbox" aria-label="Enable negative marking" />
                    <span></span>
                  </label>
                  </div>
                  <input className="in" id="negative-marking" type="number" min="0" step="any" defaultValue="0" style={{ fontWeight: "600" }} />
                </div>
              </div>
              <div className="duration-field">
                <div className="duration-toggle">
                  <label className="f" htmlFor="duration-enabled">Set a time limit</label>
                  <label className="sw" htmlFor="duration-enabled">
                    <input id="duration-enabled" type="checkbox" defaultChecked aria-label="Set a time limit" />
                    <span></span>
                  </label>
                </div>
                <div className="dur" id="duration-controls">
                  <div className="sl">
                    <select id="hh"></select>
                    <i className="bi bi-chevron-down"></i>
                  </div>
                  <span>
                    Hours
                  </span>
                  <div className="sl">
                    <select id="mm"></select>
                    <i className="bi bi-chevron-down"></i>
                  </div>
                  <span>
                    Minutes
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div className="card question-selection-card" id="question-selection-card">
            <div className="question-selection-heading">
              <div>
                <h3><i className="bi bi-ui-checks-grid"></i> Question Selection</h3>
                <p>Add or remove questions for this test. Total marks update from the selected question count.</p>
              </div>
              <span className="selection-count" id="question-selection-summary">0 questions selected</span>
            </div>
            <div className="question-selection-columns">
              <section>
                <h4>Available Questions <button className="selection-add-all" id="select-all-questions" type="button">Add all</button></h4>
                <div className="question-selection-list" id="available-question-list">
                  <p className="selection-empty">Enter the test/subject and topic to find matching questions.</p>
                </div>
              </section>
              <section>
                <h4>Selected Questions <span id="selected-question-count">0</span></h4>
                <div className="question-selection-list selected-questions" id="selected-question-list">
                  <p className="selection-empty">No questions selected.</p>
                </div>
              </section>
            </div>
          </div>
          <div className="card" style={{ paddingBottom: "18px" }}>
            <h3 style={{ marginBottom: "2px" }}>
              <i className="bi bi-bell-fill"></i>
              Notification Schedule
            </h3>
            <div className="sub">
              Send notifications to students about this test.
            </div>
            <div id="nots"></div>
            <button className="add" id="add">
              <i className="bi bi-plus-lg"></i>
              Add Notification
            </button>
            <hr />
            <div className="fb">
            <div className="btn" id="cancel-create-test">
                Cancel
              </div>
              <div className="btn p" id="create-test-submit">
                <i className="bi bi-plus-lg"></i>
                Create Test
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default memo(CreateTestPage);
