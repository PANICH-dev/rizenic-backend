*** Settings ***
Documentation     Wait for JSON, log in, open the vehicle intake form directly, and stop without saving.
Library           SeleniumLibrary    timeout=30 seconds
Library           EClaimMonitor.py
Library           EClaimDraft.py

*** Variables ***
${WATCH_DIR}           ${CURDIR}/job-json-input
${POLL_SECONDS}        2
${WATCH_TIMEOUT}       0
${ECLAIM_URL}          https://eclaim2.blueventuregroup.co.th/eclaim
${CREDENTIALS_FILE}    ${CURDIR}/.local/eclaim-credentials.json
${STEP_DELAY}          0.2 seconds
${ECLAIM_INSURER_ID}    ${EMPTY}

*** Test Cases ***
Monitor JSON And Login To E Claim
    ${json_file}=    Wait For Ready Json    ${WATCH_DIR}    ${POLL_SECONDS}    ${WATCH_TIMEOUT}
    Log    Trigger file: ${json_file}
    Close Previous Robot Sessions
    ${options}=    Evaluate    selenium.webdriver.ChromeOptions()    modules=selenium.webdriver
    Call Method    ${options}    add_experimental_option    detach    ${TRUE}
    Open Browser    ${ECLAIM_URL}    chrome    options=${options}
    Maximize Browser Window
    Set Selenium Speed    ${STEP_DELAY}
    Wait Until Element Is Visible    id:txtUserName
    Fill Eclaim Credentials    ${CREDENTIALS_FILE}
    ${login_url}=    Get Location
    Click Button    id:imbLogin
    Wait Until Keyword Succeeds    30 seconds    1 second    Login Page Should Be Left    ${login_url}
    Open Vehicle Intake Page
    Wait Until Element Is Visible    id:ddlInsurer
    Wait Until Element Is Visible    id:txtCarRegNo
    Fill Intake Draft From Json    ${json_file}    ${OUTPUT DIR}    0.2    ${ECLAIM_INSURER_ID}
    Capture Page Screenshot    eclaim-after-login.png
    Log    Filled available JSON values. Browser left open with Save disabled. No save attempted.    console=${TRUE}

*** Keywords ***
Login Page Should Be Left
    [Arguments]    ${login_url}
    ${current_url}=    Get Location
    Should Not Be Equal    ${current_url}    ${login_url}
    Element Should Not Be Visible    id:txtUserName
    Element Should Not Be Visible    id:txtPassWord
