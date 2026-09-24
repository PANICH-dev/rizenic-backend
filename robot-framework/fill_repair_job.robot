*** Settings ***
Documentation     Fill repair job fields visibly, submit once, and leave Chrome open.
Library           SeleniumLibrary    timeout=20 seconds
Library           DateTime
Library           FormHelpers.py
Library           EClaimDraft.py

*** Variables ***
${URL}            http://localhost:3001/index.html
${USERNAME}       local-navamin
${PASSWORD}       %{RIZENIC_PASSWORD=RizenicLocal123!}
${STEP_DELAY}     0.2 seconds
${SUBMIT}         ${TRUE}

*** Test Cases ***
Login Fill And Submit Repair Job
    ${submit_enabled}=    Convert To Boolean    ${SUBMIT}
    Set Selenium Speed    ${STEP_DELAY}
    Close Previous Robot Sessions
    ${options}=    Evaluate    selenium.webdriver.ChromeOptions()    modules=selenium.webdriver
    Call Method    ${options}    add_experimental_option    detach    ${TRUE}
    Open Browser    ${URL}    chrome    options=${options}
    Maximize Browser Window
    Wait Until Element Is Visible    id:login-username
    Wait Until Keyword Succeeds    5 seconds    500 milliseconds    Fill Login Username
    Input Password    id:login-password    ${PASSWORD}
    Click Button    css:[data-testid="login-submit"]
    Wait Until Element Is Visible    css:[data-testid="repair-job-form"]
    Page Should Contain    เปิดบิลและประเมินงานซ่อม
    Wait Until Page Contains Element    css:#customer-type-list option
    Wait Until Page Contains Element    css:[data-testid="job-status"] option:not([value=""])
    Fill Customer And Vehicle
    Fill Reference Documents
    Fill Body Parts And Purchase Items
    Fill Appointment Dates
    Fill Workflow
    Fill Legacy Intake Details
    Fill E Claim Details
    Fill Estimate Items
    Set Selenium Speed    0 seconds
    All Available Fields Should Be Filled
    Element Should Be Enabled    css:[data-testid="save-job-button"]
    Page Should Not Contain Element    css:[data-testid="job-notice"]
    Execute Javascript    window.scrollTo(0, 0)
    Capture Page Screenshot    repair-job-filled.png
    IF    $submit_enabled
        Set Selenium Speed    ${STEP_DELAY}
        Scroll Element Into View    css:[data-testid="save-job-button"]
        Sleep    ${STEP_DELAY}
        Click Button    css:[data-testid="save-job-button"]
        Wait Until Element Is Visible    css:[data-testid="job-notice"]    30 seconds
        ${notice}=    Get Text    css:[data-testid="job-notice"]
        Should Contain    ${notice}    เปิดบิลเรียบร้อย
        Log    ${notice}    console=${TRUE}
        Capture Page Screenshot    repair-job-submitted.png
    ELSE
        Log    Form is filled but NOT saved. Chrome stays open for review.
    END

*** Keywords ***
Fill Login Username
    Fill Text    id:login-username    ${USERNAME}
    Textfield Value Should Be    id:login-username    ${USERNAME}

Fill Customer And Vehicle
    ${sa}=    Get Value    css:[data-testid="sa-owner"]
    Should Not Be Empty    ${sa}
    Fill Text    id:customer-name    ลูกค้าทดสอบ Robot Framework
    Fill Text    id:phone-number    0810000000
    ${customer_type}=    Get Element Attribute    css:#customer-type-list option    value
    Fill Text    css:[data-testid="customer-type"]    ${customer_type}
    Select From List By Index    css:[data-testid="payment-type"]    1
    Fill Text    id:car-plate    ทดสอบ 9999
    Fill Text    css:input[list="brand-list"]    Tesla
    Wait Until Keyword Succeeds    10 seconds    500 milliseconds    Select From List By Index    xpath://label[normalize-space(text())="รุ่นรถ"]/select    1
    Fill Text    id:vin-no    LRW3E7FA0MC123456

Fill Reference Documents
    Fill Text    xpath://label[normalize-space(text())="เลขที่ เคลม/รับแจ้ง"]/input    TEST-CLM-20260923-001
    Fill Text    xpath://label[normalize-space(text())="ใบเสนอราคา (QT)"]/input    TEST-QT-20260923-001
    Fill Text    xpath://label[normalize-space(text())="ใบสั่งซ่อม (SO)"]/input    TEST-SO-20260923-001
    Fill Text    xpath://label[normalize-space(text())="ใบวางบิล / แจ้งหนี้ (BL)"]/input    TEST-BL-20260923-001
    # BL is read-only; the application controls this value.

Fill Body Parts And Purchase Items
    Wait Until Page Contains Element    css:.parts-choice > div:first-child .part-chip
    Click Button    css:.parts-choice > div:first-child .part-chip
    Click Button    css:.parts-choice > div:nth-child(2) .part-chip
    Page Should Contain Element    css:.selected-main
    Page Should Contain Element    css:.selected-sub
    Click Button    xpath://section[.//h2[contains(.,'สร้างใบสั่งซื้ออะไหล่')]]//button[contains(.,'เพิ่มรายการ')]
    Wait Until Page Contains Element    css:#parts-list option
    ${part_no}=    Get Element Attribute    css:#parts-list option    value
    Fill Text    css:input[list="parts-list"]    ${part_no}
    ${row}=    Set Variable    xpath://section[.//h2[contains(.,'สร้างใบสั่งซื้ออะไหล่')]]//tbody/tr[1]
    Fill Text    ${row}/td[2]/input    TEST-MAIN-001
    Fill Text    ${row}/td[3]/input    อะไหล่ตัวอย่างสำหรับทดสอบ
    Select From List By Label    ${row}/td[5]/select    อะไหล่หลัก
    Fill Text    ${row}/td[9]/input    1

Fill Appointment Dates
    ${today}=    Get Current Date    result_format=%Y-%m-%d
    ${arrived}=    Add Time To Date    ${today}    1 day    result_format=%Y-%m-%d
    ${finished}=    Add Time To Date    ${today}    5 days    result_format=%Y-%m-%d
    ${delivery}=    Add Time To Date    ${today}    6 days    result_format=%Y-%m-%d
    Set Date Field    xpath://label[normalize-space(text())="1. ติดต่อสอบถาม"]/input    ${today}
    Set Date Field    xpath://label[normalize-space(text())="2. รถเข้าจอดอู่"]/input    ${arrived}
    Set Date Field    xpath://label[normalize-space(text())="3. กำหนดซ่อมเสร็จ"]/input    ${finished}
    Set Date Field    xpath://label[normalize-space(text())="4. ซ่อมเสร็จจริง"]/input    ${finished}
    Set Date Field    xpath://label[normalize-space(text())="5. ส่งมอบรถลูกค้า"]/input    ${delivery}

Fill Workflow
    Select From List By Label    xpath://label[normalize-space(text())="ประเภทการรับรถ"]/select    จอดซ่อม
    Select From List By Index    css:[data-testid="job-status"]    1
    Select From List By Label    xpath://label[normalize-space(text())="ส่งต่อแผนก"]/select    บริการ
    Fill Text    id:notes    ข้อมูลตัวอย่างสำหรับทดสอบ Robot Framework เท่านั้น: ประเมินรอยกันชนหน้าและสีตัวถัง วันที่ทั้งหมดเป็นข้อมูลจำลอง

Fill E Claim Details
    Fill Text    xpath://label[normalize-space(text())="จังหวัดรถ"]/input    กรุงเทพมหานคร
    Fill Text    xpath://label[normalize-space(text())="แบบรถ (Trim Level)"]/input    Standard Range
    Fill Text    xpath://label[normalize-space(text())="เลขไมล์ (กิโลเมตร)"]/input    25000
    Fill Text    xpath://label[normalize-space(text())="ขนาดเครื่องยนต์ (CC)"]/input    0
    Fill Text    xpath://label[normalize-space(text())="คันที่เกิดอุบัติเหตุ"]/input    1
    Select From List By Value    xpath://label[normalize-space(text())="ประเภทรถ"]/select    O
    Select From List By Value    xpath://label[normalize-space(text())="สภาพรถ"]/select    0
    Select From List By Value    xpath://label[normalize-space(text())="รถประกัน/คู่กรณี"]/select    own

Fill Legacy Intake Details
    Fill Text    xpath://label[normalize-space(text())="เลขบัตรประชาชน"]/input    0000000000000
    Fill Text    xpath://label[normalize-space(text())="ที่อยู่ผู้ติดต่อ"]/textarea    ที่อยู่จำลองสำหรับ Robot Framework เท่านั้น: 999 ถนนทดสอบ กรุงเทพมหานคร 10240
    Fill Text    xpath://label[normalize-space(text())="ระดับเชื้อเพลิง (E / 1/4 / 1/2 / 3/4 / F)"]/input    1/2
    Select Checkbox    xpath://section[contains(@class,'legacy-intake-card')]//label[normalize-space(.)="แม่แรง"]/input
    Select Checkbox    xpath://section[contains(@class,'legacy-intake-card')]//label[normalize-space(.)="ยางอะไหล่"]/input
    Fill Text    xpath://label[normalize-space(text())="จังหวัดทะเบียน"]/input    กรุงเทพ ฯ
    Fill Text    xpath://label[normalize-space(text())="ปีรถ"]/input    2024
    Fill Text    xpath://label[normalize-space(text())="สีรถ"]/input    ขาว
    Fill Text    xpath://label[normalize-space(text())="เลขกรมธรรม์"]/input    TEST-POLICY-20260923-001
    Fill Text    xpath://label[normalize-space(text())="เลขรับแจ้ง"]/input    TEST-NOTIFY-20260923-001
    Fill Text    xpath://label[normalize-space(text())="เวลานัด"]/input    09:00
    Fill Text    xpath://label[normalize-space(text())="ชื่อเจ้าหน้าที่นำรถเข้าซ่อม"]/input    ริณภัทร ฐินปุตโต
    Fill Text    xpath://label[normalize-space(text())="Line ผู้ติดต่อ"]/input    robot-customer-line
    Fill Text    xpath://label[normalize-space(text())="Email ผู้ติดต่อ"]/input    customer.robot@example.com
    Fill Text    xpath://label[normalize-space(text())="Line ผู้นำรถเข้าซ่อม"]/input    robot-intake-line
    Fill Text    xpath://label[normalize-space(text())="Email ผู้นำรถเข้าซ่อม"]/input    intake.robot@example.com
    Fill Text    xpath://label[normalize-space(text())="ประมาณค่าแรง"]/input    2500
    Select From List By Label    xpath://label[normalize-space(text())="ประเภทงานซ่อม"]/select    Q1
    Select From List By Label    xpath://label[normalize-space(text())="มีรายการอะไหล่"]/select    มี

Fill Estimate Items
    Click Button    xpath://button[contains(.,'เพิ่มรายการ (Manual)')]
    ${row}=    Set Variable    xpath://section[contains(@class,'eclaim-card')]//tbody/tr[1]
    Fill Text    ${row}/td[1]/input    ค่าแรงทำสี
    Fill Text    ${row}/td[2]/input    TEST-PAINT-001
    Fill Text    ${row}/td[3]/input    ทำสีกันชนหน้า (ข้อมูลทดสอบ)
    Fill Text    ${row}/td[4]/input    1
    Fill Text    ${row}/td[5]/input    2500
    Element Text Should Be    ${row}/td[6]    2500
