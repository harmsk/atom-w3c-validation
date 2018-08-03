"use babel";

import { MessagePanelView, LineMessageView, PlainMessageView } from "atom-message-panel";
import W3CHTMLValidator from "w3cjs";
import W3CCSSValidator from "w3c-css";

let oMessagesPanel = new MessagePanelView( {
        "rawTitle": true,
        "closeMethod": "destroy"
    } ),
    panelBody = oMessagesPanel.body,
    dock = {
      element: panelBody[0],
      getTitle: () => 'W3C Validation Service',
      getURI: () => 'atom://w3c-validation',
      getDefaultLocation: () => 'bottom'
    },
    initializeDock = true,
    fValidate,
    fShowError,
    fShowResults;

fShowError = function( oError ) {
    oMessagesPanel.clear();
    oMessagesPanel.add( new PlainMessageView( {
        "message": '<span class="icon-alert"></span> Validation fails with error.',
        "preview": oError.message,
        "raw": true,
        "className": "text-error"
    } ) );
};

fShowResults = function( oEditor, aMessages ) {
    let iErrorCount = 0,
        iWarningCount = 0,
        aFilteredMessages, sErrorReport, sWarningReport;
    let views = [];

    oMessagesPanel.clear();
    aFilteredMessages = aMessages.filter( ( oMessage ) => {
        return oMessage.type !== "info";
    } );
    if ( aFilteredMessages.length === 0 ) {
        views.push( new PlainMessageView( {
            "message": '<span class="icon-check"></span> No errors were found!',
            "raw": true,
            "className": "text-success"
        } ) );
    }
    for ( let oMessage of aFilteredMessages ) {
        if ( oMessage.type !== "info" ) {
            ( oMessage.type === "error" ) && iErrorCount++;
            ( oMessage.type === "warning" ) && iWarningCount++;
            views.push( new LineMessageView( {
                "character": oMessage.lastColumn,
                "className": `text-${ oMessage.type }`,
                "line": oMessage.lastLine,
                "message": oMessage.message,
                "preview": ( oEditor.lineTextForBufferRow( oMessage.lastLine - 1 ) || "" ).trim()
            } ) );
        }
    }

    sErrorReport = `${ iErrorCount } error${ iErrorCount > 1 || iErrorCount == 0 ? "s" : "" }`;
    sWarningReport = `${ iWarningCount } warning${ iWarningCount > 1 || iWarningCount == 0 ? "s" : "" }`;
    oMessagesPanel.add( new PlainMessageView( {
        "message": `<span class="icon-microscope"></span>${oEditor.getPath()} - ${ sErrorReport }, ${ sWarningReport }`,
        "raw": true,
    } ) );

    views.forEach(function(element) {
      oMessagesPanel.add(element);
    });
};

fValidate = function() {
    let oEditor,
        oValidatorOptions;

    if ( !( oEditor = atom.workspace.getActiveTextEditor() ) ) {
        return;
    }

    oMessagesPanel.clear();
    if (initializeDock) {
      atom.workspace.open(dock);
      initializeDock = false;
    } else {
      atom.workspace.open(dock, {activatePane: false});
    }

    oMessagesPanel.add( new PlainMessageView( {
        "message": `<span class="icon-hourglass"></span> Validating ${oEditor.getPath()}`,
        "raw": true,
        "className": "text-info"
    } ) );

    if ( oEditor.getGrammar().scopeName.indexOf( "html" ) > -1 ) {
        oValidatorOptions = {
            "input": oEditor.getText(),
            callback( oResponse ) {
                if ( !oResponse || !oResponse.messages ) {
                    oMessagesPanel.add( new PlainMessageView( {
                        "message": '<span class="icon-alert"></span> Validation fails without error.',
                        "raw": true,
                        "className": "text-error"
                    } ) );
                    return;
                }
                fShowResults( oEditor, oResponse.messages );
            }
        };

        try {
            W3CHTMLValidator.validate( oValidatorOptions );
        } catch ( oError ) {
            fShowError( oError );
        }
    }

    if ( oEditor.getGrammar().scopeName.indexOf( "css" ) > -1 ) {
        oValidatorOptions = {
            "text": oEditor.getText(),
            "profile": atom.config.get( "w3c-validation.cssProfile" ),
            "medium": atom.config.get( "w3c-validation.cssMedia" )
        };
        switch ( atom.config.get( "w3c-validation.cssReportType" ) ) {
            case "all":
                oValidatorOptions.warnings = 2;
                break;
            case "most important":
                oValidatorOptions.warnings = 0;
                break;
            case "no warnings":
                oValidatorOptions.warnings = "no";
                break;
            default:
                oValidatorOptions.warnings = 1;
                break;
        }
        try {
            W3CCSSValidator.validate( oValidatorOptions, ( oError, aResults ) => {
                let aParsedErrors,
                    aParsedWarnings;

                if ( oError ) {
                    fShowError( oError );
                    return;
                }
                aParsedErrors = ( aResults.errors || [] ).map( ( oMessage ) => {
                    return {
                        "lastLine": oMessage.line,
                        "type": "error",
                        "message": oMessage.message
                    };
                } );
                aParsedWarnings = ( aResults.warnings || [] ).map( ( oMessage ) => {
                    return {
                        "lastLine": oMessage.line,
                        "type": "warning",
                        "message": oMessage.message
                    };
                } );
                fShowResults( oEditor, [].concat( aParsedErrors, aParsedWarnings ) );
            } );
        } catch ( oError ) {
            fShowError( oError );
        }
    }
};

export default fValidate;
