import React from 'react';
import PropTypes from 'prop-types';
import { remote } from 'electron'; // eslint-disable-line import/no-extraneous-dependencies

import Form from 'react-bootstrap/Form';

import ArgInput from '../ArgInput';
import { fetchDatastackFromFile } from '../../../server_requests';
import { boolStringToBoolean } from '../../../utils';

/** Prevent the default case for onDragOver so onDrop event will be fired. */
function dragOverHandler(event) {
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';
}

/** Renders a form with a list of input components. */
export default class ArgsForm extends React.Component {
  constructor(props) {
    super(props);
    this.handleChange = this.handleChange.bind(this);
    this.inputDropHandler = this.inputDropHandler.bind(this);
    this.handleBoolChange = this.handleBoolChange.bind(this);
    this.selectFile = this.selectFile.bind(this);
    this.onArchiveDragDrop = this.onArchiveDragDrop.bind(this);
    this.dragEnterHandler = this.dragEnterHandler.bind(this);
    this.dragLeaveHandler = this.dragLeaveHandler.bind(this);
    this.formRef = React.createRef(); // For dragging CSS
    this.dragDepth = 0;  // To determine Form dragging CSS 
  }

  async onArchiveDragDrop(event) {
    /** Handle drag-drop of datastack JSON files and InVEST logfiles */
    event.preventDefault();
    event.stopPropagation();
    // No longer dragging so reset dragging depth and remove CSS
    this.dragDepth = 0;
    const formElement = this.formRef.current;
    formElement.classList.remove("dragging");

    const fileList = event.dataTransfer.files;
    if (fileList.length !== 1) {
      throw alert('only drop one file at a time.');
    }
    const datastack = await fetchDatastackFromFile(fileList[0].path);

    if (datastack.module_name === this.props.pyModuleName) {
      this.props.batchUpdateArgs(datastack.args);
    } else {
      throw alert(`Parameter/Log file for ${datastack.module_name} does not match this model: ${this.props.pyModuleName}`)
    }
  }

  /** Handle drag enter events for the Form elements. */
  dragEnterHandler(event) {
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'move';
    this.dragDepth++;
    const formElement = this.formRef.current;
    if (!formElement.classList.contains("dragging")) {
      formElement.classList.add("dragging");
    }
  }

  /** Handle drag leave events for the Form elements. */
  dragLeaveHandler(event) {
    event.preventDefault();
    event.stopPropagation();
    this.dragDepth--;
    const formElement = this.formRef.current;
    if (this.dragDepth <= 0 ) {
        formElement.classList.remove("dragging");
    }
  }

  /** Handle drop events for input elements from the ArgInput components. */
  inputDropHandler(event) {
    event.preventDefault();
    event.stopPropagation();
    const { name, value } = event.target; // the arg's key and type
    // TODO: could add more filters based on argType (e.g. only show .csv)
    const fileList = event.dataTransfer.files;
    if (fileList.length) {
      this.props.updateArgValues(name, fileList[0].path); 
    }
  }

  handleChange(event) {
    /** Pass input value up to setuptab for storage & validation. */
    const { name, value } = event.target;
    this.props.updateArgValues(name, value);
  }

  handleBoolChange(event) {
    /** Handle changes from boolean inputs that submit strings */
    const { name, value } = event.target;
    const boolVal = boolStringToBoolean(value);
    this.props.updateArgValues(name, boolVal);
  }

  async selectFile(event) {
    /** Handle clicks on browse-button inputs */
    const { name, value } = event.target; // the arg's key and type
    const prop = (value === 'directory') ? 'openDirectory' : 'openFile';
    // TODO: could add more filters based on argType (e.g. only show .csv)
    const data = await remote.dialog.showOpenDialog({ properties: [prop] });
    if (data.filePaths.length) {
      this.props.updateArgValues(name, data.filePaths[0]); // dialog defaults allow only 1 selection
    }
  }

  render() {
    const {
      sortedArgKeys,
      argsSpec,
      argsValues,
      argsValidation,
    } = this.props;
    const formItems = [];
    let k = 0;

    sortedArgKeys.forEach((groupArray) => {
      k += 1;
      const groupItems = [];
      groupArray.forEach((argkey) => {
        groupItems.push(
          <ArgInput
            key={argkey}
            argkey={argkey}
            argSpec={argsSpec[argkey]}
            value={argsValues[argkey].value}
            touched={argsValues[argkey].touched}
            ui_option={argsValues[argkey].ui_option}
            isValid={argsValidation[argkey].valid}
            validationMessage={argsValidation[argkey].validationMessage}
            handleChange={this.handleChange}
            inputDropHandler={this.inputDropHandler}
            handleBoolChange={this.handleBoolChange}
            selectFile={this.selectFile}
          />
        );
      });
      formItems.push(
        <div className="arg-group" key={k}>
          {groupItems}
        </div>
      );
    });

    return (
      <Form
        ref={this.formRef}
        data-testid="setup-form"
        className="args-form"
        validated={false}
        onDrop={this.onArchiveDragDrop}
        onDragOver={dragOverHandler}
        onDragEnter={this.dragEnterHandler}
        onDragLeave={this.dragLeaveHandler}
      >
        {formItems}
      </Form>
    );
  }
}

ArgsForm.propTypes = {
  argsValues: PropTypes.objectOf(
    PropTypes.shape({
      value: PropTypes.oneOfType([PropTypes.string, PropTypes.bool]),
      touched: PropTypes.bool,
    }),
  ).isRequired,
  argsValidation: PropTypes.objectOf(
    PropTypes.shape({
      validationMessage: PropTypes.string,
      valid: PropTypes.bool,
    }),
  ).isRequired,
  argsSpec: PropTypes.objectOf(
    PropTypes.shape({
      name: PropTypes.string,
      type: PropTypes.string,
    }),
  ).isRequired,
  sortedArgKeys: PropTypes.arrayOf(
    PropTypes.arrayOf(PropTypes.string),
  ).isRequired,
  updateArgValues: PropTypes.func.isRequired,
  batchUpdateArgs: PropTypes.func.isRequired,
  pyModuleName: PropTypes.string.isRequired,
};
