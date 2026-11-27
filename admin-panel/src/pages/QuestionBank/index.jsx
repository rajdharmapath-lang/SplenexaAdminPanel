import { memo } from 'react';
import useLegacyScript from '../../legacy/useLegacyScript';
import init from './legacy';
import AccountMenu from '../../components/AccountMenu';
import './styles.css';

function QuestionBankPage() {
  const ref = useLegacyScript(init);
  return (
    <div className="pg pg-question-bank" ref={ref}>
      <main>
        <div className="top">
          <label className="search">
            <i className="bi bi-search"></i>
            <input placeholder="Search students, topics, videos, payments..." />
          </label>
          <div className="r">
            <div className="bell">
              <i className="bi bi-bell"></i>
              <em>
                3
              </em>
            </div>
            <AccountMenu />
          </div>
        </div>
        <div className="wrap">
          <div className="product-browser" id="product-browser">
            <div className="product-browser-head">
              <div>
                <h1>Question Bank Products</h1>
                <p>Create and manage products for your question bank.</p>
              </div>
              <div className="product-browser-actions">
                <a className="back-list" href="#fmge-dashboard">
                  <i className="bi bi-arrow-left"></i>
                  Back
                </a>
                <button className="add-subject" id="create-product" type="button">
                  <i className="bi bi-plus-circle"></i>
                  Create Product
                </button>
              </div>
            </div>
            <div className="product-list" id="product-list"></div>
          </div>
          <div className="card question-list" id="question-list">
            <div className="question-list-head">
              <h2 id="question-list-title">Subjects</h2>
              <h2 className="active-product-title" id="active-product-title" hidden></h2>
              <div className="question-list-actions">
                <button className="add-question" id="create-test-from-product" type="button">
                  <i className="bi bi-plus-lg"></i>
                  Create Test
                </button>
                <button className="back-list" id="back-question-list" type="button" style={{ display: "none" }}>
                  <i className="bi bi-arrow-left"></i>
                  <span>Back</span>
                </button>
                <button className="add-question topic-create-question" id="create-question-from-topic" type="button">
                  <i className="bi bi-plus-lg"></i>
                  Create Question
                </button>
                <button className="add-subject" id="create-subject-from-product" type="button" hidden>
                  <i className="bi bi-plus-circle"></i>
                  Create Subject
                </button>
              </div>
            </div>
            <div className="subject-list" id="subject-list"></div>
          </div>
        </div>
      </main>
      <div className="subject-dialog product-dialog" id="product-dialog">
        <div className="subject-dialog-box">
          <h3 id="product-dialog-title">
            <i className="bi bi-box-seam-fill"></i>
            Create Product
          </h3>
          <label htmlFor="product-name">Product Name</label>
          <input id="product-name" placeholder="Enter product name" />
          <label htmlFor="product-description">Product Description</label>
          <textarea id="product-description" placeholder="Describe this product"></textarea>
          <fieldset className="product-access">
            <legend>Access Type</legend>
            <label><input type="radio" name="product-access" value="Paid" defaultChecked /> Paid</label>
            <label><input type="radio" name="product-access" value="Free" /> Free</label>
          </fieldset>
          <label className="product-active-toggle">
            <input id="product-active" type="checkbox" defaultChecked />
            <span className="toggle-track"></span>
            Active
          </label>
          <label className="product-active-toggle">
            <input id="product-topics-enabled" type="checkbox" defaultChecked />
            <span className="toggle-track"></span>
            Organize subjects by topics
          </label>
          <fieldset className="product-access">
            <legend>Is Review Enabled</legend>
            <label><input type="radio" name="product-review-enabled" value="true" /> Yes</label>
            <label><input type="radio" name="product-review-enabled" value="false" defaultChecked /> No</label>
          </fieldset>
          <label htmlFor="product-icon-code">Bootstrap icon code</label>
          <div className="product-icon-code-field">
            <i id="product-icon-code-preview" className="bi bi-box-seam-fill" aria-hidden="true"></i>
            <input id="product-icon-code" placeholder="bi bi-box-seam-fill" autoComplete="off" />
          </div>
          <small className="product-icon-code-help">Use a Bootstrap Icons class such as <code>bi bi-book-fill</code>. If blank, the upload or default icon is used.</small>
          <div className="product-icon-upload">
            <div className="product-icon-preview" id="product-icon-preview">
              <i className="bi bi-image"></i>
            </div>
            <div className="product-icon-controls">
              <input id="product-icon-file" type="file" accept="image/png,image/jpeg,image/webp" hidden />
              <button className="product-icon-button" id="product-icon-upload" type="button">
                <i className="bi bi-cloud-arrow-up-fill"></i>
                Upload product icon
              </button>
              <button className="product-icon-remove" id="product-icon-remove" type="button" hidden>
                Remove
              </button>
              <small id="product-icon-name">PNG, JPG, or WebP · up to 256 KB</small>
            </div>
          </div>
          <label className="product-active-toggle">
            <input id="product-icon-enabled" type="checkbox" defaultChecked />
            <span className="toggle-track"></span>
            Use custom icon on product card
          </label>
          <div className="edit-actions">
            <button id="cancel-product" type="button">Cancel</button>
            <button className="save" id="save-product" type="button">Create Product</button>
          </div>
        </div>
      </div>
      <div className="subject-dialog" id="create-subject-dialog">
        <div className="subject-dialog-box">
          <h3 id="subject-dialog-title">
            <i className="bi bi-plus-circle-fill"></i>
            Create Subject
          </h3>
          <label id="subject-dialog-label" htmlFor="new-subject-name">Subject Name</label>
          <input id="new-subject-name" placeholder="Enter subject name" />
          <div className="topic-icon-code-editor" id="topic-icon-code-field" hidden>
            <label htmlFor="topic-icon-code">Bootstrap icon or image URL (optional)</label>
            <div className="product-icon-code-field">
              <span id="topic-icon-code-preview"><i className="bi bi-bookmark-fill" aria-hidden="true"></i></span>
              <input id="topic-icon-code" placeholder="Paste icon class or HTTPS image URL" autoComplete="off" />
            </div>
            <small className="product-icon-code-help">Optional. Use a Bootstrap icon class or an HTTPS image URL.</small>
          </div>
          <div className="edit-actions">
            <button id="cancel-create-subject" type="button">Cancel</button>
            <button className="save" id="save-create-subject" type="button">Save</button>
          </div>
        </div>
      </div>
      <div className="question-dialog" id="view-question-dialog">
        <div className="question-dialog-box">
          <h3>
            <i className="bi bi-eye-fill"></i>
            View Question
          </h3>
          <label>
            Question
          </label>
          <div id="view-question-text"></div>
          <label>
            Subject
          </label>
          <div id="view-question-subject"></div>
          <label>
            Topic
          </label>
          <div id="view-question-topic"></div>
          <label>
            Difficulty
          </label>
          <div id="view-question-difficulty"></div>
          <label>
            Tags
          </label>
          <div id="view-question-tags"></div>
          <label>Options</label>
          <ol id="view-question-options"></ol>
          <label>Correct Answer</label>
          <div id="view-question-answer"></div>
          <div className="question-dialog-actions">
            <button type="button" data-close-question-dialog="">
              Close
            </button>
          </div>
        </div>
      </div>
      <div className="question-dialog" id="edit-question-dialog">
        <div className="question-dialog-box">
          <h3>
            <i className="bi bi-pencil-fill"></i>
            Edit Question
          </h3>
          <div className="edit-question-layout">
            <div className="edit-question-card">
              <h3>
                <i className="bi bi-file-earmark-text-fill"></i>
                Question Text
              </h3>
              <div className="edit-section">
                <div className="rich-editor">
                  <div className="rich-toolbar" data-editor-toolbar="edit-question-text"></div>
                  <div id="edit-question-text" className="rich-body" contentEditable="true"></div>
                </div>
                <div className="question-attachment">
                  <h5>
                    <i className="bi bi-image-fill"></i>
                    <b>
                      Attach Image
                    </b>
                    {" "}
                    <span>
                      (Optional)
                    </span>
                  </h5>
                  <div className="question-drop">
                    <i className="bi bi-cloud-arrow-up"></i>
                    Drag &amp; drop an image here
                    <br />
                    or
                    <br />
                    <button type="button">
                      Choose File
                    </button>
                  </div>
                  <small>
                    Supported formats: JPG, PNG, GIF
                    <br />
                    (Max size: 5MB)
                  </small>
                </div>
              </div>
              <h3>
                <i className="bi bi-patch-check-fill"></i>
                Options
              </h3>
              <div className="edit-options">
                <div>
                  <label>
                    Option 1
                  </label>
                  <div className="rich-editor">
                    <div className="rich-toolbar option-rich-toolbar" data-editor-toolbar="edit-option-1"></div>
                    <div id="edit-option-1" className="rich-body" contentEditable="true"></div>
                  </div>
                </div>
                <div>
                  <label>
                    Option 2
                  </label>
                  <div className="rich-editor">
                    <div className="rich-toolbar option-rich-toolbar" data-editor-toolbar="edit-option-2"></div>
                    <div id="edit-option-2" className="rich-body" contentEditable="true"></div>
                  </div>
                </div>
                <div>
                  <label>
                    Option 3
                  </label>
                  <div className="rich-editor">
                    <div className="rich-toolbar option-rich-toolbar" data-editor-toolbar="edit-option-3"></div>
                    <div id="edit-option-3" className="rich-body" contentEditable="true"></div>
                  </div>
                </div>
                <div>
                  <label>
                    Option 4
                  </label>
                  <div className="rich-editor">
                    <div className="rich-toolbar option-rich-toolbar" data-editor-toolbar="edit-option-4"></div>
                    <div id="edit-option-4" className="rich-body" contentEditable="true"></div>
                  </div>
                </div>
              </div>
              <h3>
                <i className="bi bi-file-earmark-text-fill"></i>
                Explanation
              </h3>
              <div className="edit-section">
                <div className="rich-editor">
                  <div className="rich-toolbar" data-editor-toolbar="edit-explanation"></div>
                  <div id="edit-explanation" className="rich-body" contentEditable="true"></div>
                </div>
                <div className="question-attachment">
                  <h5>
                    <i className="bi bi-image-fill"></i>
                    <b>
                      Attach Image
                    </b>
                    {" "}
                    <span>
                      (Optional)
                    </span>
                  </h5>
                  <div className="question-drop">
                    <i className="bi bi-cloud-arrow-up"></i>
                    Drag &amp; drop an image here
                    <br />
                    or
                    <br />
                    <button type="button">
                      Choose File
                    </button>
                  </div>
                  <small>
                    Supported formats: JPG, PNG, GIF
                    <br />
                    (Max size: 5MB)
                  </small>
                </div>
              </div>
            </div>
            <div className="edit-meta-card">
              <h3>
                <i className="bi bi-gear-fill"></i>
                Question Metadata
              </h3>
              <div className="edit-meta-grid">
                <div className="edit-meta-field">
                  <label htmlFor="edit-question-subject">
                    Subject
                  </label>
                  <select id="edit-question-subject"></select>
                </div>
                <div className="edit-meta-field full">
                  <label htmlFor="edit-question-topic">
                    Topic
                  </label>
                  <input id="edit-question-topic" />
                </div>
                <div className="edit-meta-field">
                  <label htmlFor="edit-question-difficulty">
                    Difficulty Level
                  </label>
                  <select id="edit-question-difficulty">
                    <option>
                      Easy
                    </option>
                    <option>
                      Medium
                    </option>
                    <option>
                      Hard
                    </option>
                  </select>
                </div>
                <div className="edit-meta-field">
                  <label htmlFor="edit-question-status">
                    Status
                  </label>
                  <select id="edit-question-status">
                    <option>
                      Active
                    </option>
                    <option>
                      Inactive
                    </option>
                    <option>
                      Draft
                    </option>
                  </select>
                </div>
              </div>
              <div className="edit-answer">
                <i className="bi bi-info-circle-fill"></i>
                <div>
                  <b>
                    Correct Answer
                  </b>
                  <br />
                  <select id="edit-correct-option">
                    <option value="0">
                      Option 1
                    </option>
                    <option value="1">
                      Option 2
                    </option>
                    <option value="2">
                      Option 3
                    </option>
                    <option value="3">
                      Option 4
                    </option>
                  </select>
                </div>
              </div>
              <div className="edit-meta-field">
                <label htmlFor="edit-question-tags">
                  Tags (Optional)
                </label>
                <input id="edit-question-tags" placeholder="Add tags (e.g. hypertension, cardiovascular)" />
              </div>
              <div className="edit-tips">
                <h5>
                  <i className="bi bi-lightbulb-fill"></i>
                  Quick Tips
                </h5>
                <ul>
                  <li>
                    Use high-quality images (clear and readable).
                  </li>
                  <li>
                    Add detailed explanations for better learning.
                  </li>
                  <li>
                    Choose the correct subject and difficulty.
                  </li>
                </ul>
              </div>
            </div>
          </div>
          <div className="question-dialog-actions">
            <button type="button" data-close-question-dialog="">
              Cancel
            </button>
            <button className="primary" id="save-question-edit" type="button">
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default memo(QuestionBankPage);
