*** Settings ***
Documentation     Login to RIZENIC, wait 10 seconds, then logout.
Library           SeleniumLibrary    timeout=20 seconds
Test Teardown     Close All Browsers

*** Variables ***
${URL}            http://localhost:3001/index.html
${BROWSER}        chrome
${USERNAME}       local-navamin
${PASSWORD}       %{RIZENIC_PASSWORD=RizenicLocal123!}
${DELAY}          10 seconds

*** Test Cases ***
Login Wait And Logout
    Open Browser    ${URL}    ${BROWSER}
    Maximize Browser Window
    Wait Until Element Is Visible    id:login-username
    Wait Until Keyword Succeeds    5 seconds    500 milliseconds    Fill Username
    Input Password    id:login-password    ${PASSWORD}
    Click Button    css:[data-testid="login-submit"]
    Wait Until Element Is Visible    css:[data-testid="repair-job-page"]
    Wait Until Element Is Visible    css:[data-testid="logout-button"]
    Sleep    ${DELAY}
    Click Button    css:[data-testid="logout-button"]
    Wait Until Element Is Visible    id:login-username
    Wait Until Element Is Visible    id:login-password
    Element Should Not Be Visible    css:[data-testid="repair-job-page"]
    Textfield Value Should Be    id:login-password    ${EMPTY}

*** Keywords ***
Fill Username
    Input Text    id:login-username    ${USERNAME}
    Textfield Value Should Be    id:login-username    ${USERNAME}
