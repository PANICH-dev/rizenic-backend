"""Fill the intake draft from a job JSON. There is deliberately no save keyword."""
import glob
import json
import tempfile
import time
import urllib.request
from decimal import Decimal
from pathlib import Path
from urllib.parse import urlsplit

from robot.api import logger
from robot.libraries.BuiltIn import BuiltIn
from selenium.webdriver.common.by import By
from selenium.common.exceptions import NoSuchElementException
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import Select, WebDriverWait
from websocket import create_connection


def close_previous_robot_browsers():
    for name in glob.glob(tempfile.gettempdir() + '/org.chromium.Chromium.scoped_dir.*/DevToolsActivePort'):
        port = Path(name).read_text().splitlines()[0]
        try:
            base = f'http://127.0.0.1:{int(port)}'
            with urllib.request.urlopen(base + '/json/list', timeout=1) as response:
                tabs = json.load(response)
            pages = [t for t in tabs if t.get('type') == 'page']
            if not pages or not all(
                urlsplit(t.get('url', '')).hostname in (
                    'localhost', '127.0.0.1', 'eclaim2.blueventuregroup.co.th',
                    'eclaim3.blueventuregroup.co.th', 'eclaim5.blueventuregroup.co.th')
                or t.get('url') in ('about:blank', 'chrome://newtab/') for t in pages
            ):
                continue
            with urllib.request.urlopen(base + '/json/version', timeout=1) as response:
                version = json.load(response)
            socket = create_connection(version['webSocketDebuggerUrl'], timeout=2, suppress_origin=True)
            socket.send(json.dumps({'id': 1, 'method': 'Browser.close'}))
            socket.close()
            logger.console(f'Closed previous Robot browser on port {port}')
        except (OSError, ValueError):
            continue


def get_value(data, dotted):
    value = data
    for key in dotted.split('.'):
        if not isinstance(value, dict):
            return None
        value = value.get(key)
    return value


TEXT_MAPPING = {
    'txtCarRegNo': 'vehicle.plate',
    'txtChassiNo': 'vehicle.vin',
    'txtRefClaimNo': 'documents.claim_no',
    'txtAccClaimNo': 'documents.notification_no',
    'txtAccPolicyNo': 'documents.policy_no',
    'txtClientNameContact': 'contact.name',
    'txtClientMobileContact': 'contact.mobile',
    'txtClientTelContact': 'contact.phone',
    'txtContactLine': 'contact.line',
    'txtContactEmail': 'contact.email',
    'txtClientNameCarRepair': 'inspection.customer_name',
    'txtClientMobileCarRepair': 'inspection.phone',
    'txtClientTelCarRepair': 'intake.phone',
    'txtClientIDCardCarRepair': 'intake.id_card',
    'txtClientAddressCarRepair': 'intake.address',
    'txtCarToRepContactLine': 'intake.line',
    'txtCarToRepContactEmail': 'intake.email',
    'txtKMCarRepair': 'intake.mileage',
    'txtCType': 'vehicle.type',
    'txtCMFG': 'vehicle.brand',
    'txtCModel': 'vehicle.model',
    'txtDSTYear': 'vehicle.year',
    'txtCVechTyp': 'vehicle.trim',
    'txtClientGetcardate': 'delivery.pickup_date',
    'txtClientNameGetcar': 'delivery.recipient_name',
    'txtClientIDCardGetcar': 'delivery.recipient_id_card',
    'txtClientTelGetcar': 'delivery.phone',
    'txtClientMobileGetcar': 'delivery.mobile',
    'txtKMGetcar': 'delivery.mileage',
    'txtSMSGetcar': 'delivery.sms_phone',
    'txtRelation': 'delivery.insured_relation',
    'txtRepNameGetCar': 'delivery.staff_name',
    'txtCommentGetcar': 'delivery.comment',
    'txtItemGetcar': 'delivery.inventory_notes',
    'wuCalendarContact_txtCalendar': 'dates.appointment_date',
    'wuCalendarHopeFinishDate_txtCalendar': 'dates.appointment_date',
    'wuCalendarCompleteDate_txtCalendar': 'dates.repair_complete_date',
}


class EClaimDraft:
    def close_previous_robot_sessions(self):
        close_previous_robot_browsers()

    def fill_intake_draft_from_json(self, json_file, output_directory, delay_seconds=0.2, insurer_override=''):
        driver = BuiltIn().get_library_instance('SeleniumLibrary').driver
        return fill_draft(driver, json_file, output_directory, float(delay_seconds), insurer_override)


def fill_draft(driver, json_file, output_directory, delay=0.2, insurer_override=''):
    data = json.loads(Path(json_file).read_text(encoding='utf-8-sig'))
    if 'vehicle' not in data and isinstance(data.get('payload'), dict):
        data = data['payload']
    if urlsplit(driver.current_url).path.lower() != '/eclaim/frmkeyin_inoutcar.aspx':
        raise AssertionError('Refusing to fill a page other than the vehicle intake form')
    # The page may raise its vehicle-selection validation alert asynchronously.
    try:
        alert = driver.switch_to.alert
        logger.console(f'Dismissed E-Claim alert before fill: {alert.text}')
        alert.accept()
    except Exception:
        pass
    source = Path(__file__).with_name('eclaim_no_save.js').read_text()
    driver.execute_cdp_cmd('Page.addScriptToEvaluateOnNewDocument', {'source': source})
    driver.execute_script(source)
    report = {'source_file': Path(json_file).name, 'job_id': data.get('job_id'),
              'saved': False, 'filled': [], 'skipped': [], 'assumptions': []}
    expected = {}
    # Keep a lightweight inventory so page-version changes can be mapped safely.
    controls = driver.execute_script("""
      return Array.from(document.querySelectorAll('input,select,textarea,button,a')).map(e => ({
        tag:e.tagName.toLowerCase(), id:e.id, name:e.name, type:e.type || '',
        value:e.value || '', disabled:e.disabled, readOnly:e.readOnly,
        text:(e.innerText || e.value || '').trim(), onclick:e.getAttribute('onclick') || '',
        options:e.tagName.toLowerCase()==='select' ? Array.from(e.options).map(o=>({text:o.text.trim(),value:o.value})) : []
      }));
    """)
    (Path(output_directory) / 'eclaim-controls.json').write_text(json.dumps(controls, ensure_ascii=False, indent=2))
    special = driver.execute_script("""
      return Array.from(document.querySelectorAll('*')).filter(e => {
        const t=(e.innerText||'').trim();
        return t==='เลือกรุ่นรถ' || t==='รูปชุดรถ' || /เลือกรุ่นรถ|รูปชุดรถ/.test(t);
      }).slice(0,30).map(e=>({tag:e.tagName.toLowerCase(),id:e.id,class:e.className,text:(e.innerText||'').trim(),html:e.outerHTML.slice(0,2000)}));
    """)
    (Path(output_directory) / 'eclaim-special.json').write_text(json.dumps(special, ensure_ascii=False, indent=2))
    # Inspect the legacy vehicle selector without committing any form data.
    selector = driver.find_elements(By.ID, 'divSelvech')
    if selector:
        base_handle = driver.current_window_handle
        handles_before = set(driver.window_handles)
        selector[0].click()
        time.sleep(0.5)
        try:
            WebDriverWait(driver, 5).until(lambda d: len(set(d.window_handles) - handles_before) > 0)
            new_handles = list(set(driver.window_handles) - handles_before)
            if new_handles:
                driver.switch_to.window(new_handles[-1])
        except Exception:
            pass
        selector_controls = driver.execute_script("""
          return Array.from(document.querySelectorAll('input,select,button,a,div')).filter(e => {
            const id=(e.id||'').toLowerCase(), t=(e.innerText||'').trim();
            return id.includes('frame_select') || id.includes('vech') || /รถในระบบ|รถอื่นๆ|ยี่ห้อ|รุ่น|ปี|ค้นหา|ยืนยัน/.test(t);
          }).slice(0,200).map(e=>({tag:e.tagName.toLowerCase(),id:e.id,name:e.name||'',type:e.type||'',value:e.value||'',text:(e.innerText||'').trim().slice(0,300),html:e.outerHTML.slice(0,1200)}));
        """)
        (Path(output_directory) / 'vehicle-selector-controls.json').write_text(json.dumps(selector_controls, ensure_ascii=False, indent=2))
        frames = driver.find_elements(By.ID, 'frame1')
        if frames:
            driver.switch_to.frame(frames[0])
            frame_controls = driver.execute_script("""
              return Array.from(document.querySelectorAll('input,select,button,a,div,table')).map(e=>({tag:e.tagName.toLowerCase(),id:e.id,name:e.name||'',type:e.type||'',value:e.value||'',text:(e.innerText||'').trim().slice(0,300),html:e.outerHTML.slice(0,1500)}));
            """)
            (Path(output_directory) / 'vehicle-selector-frame.json').write_text(json.dumps(frame_controls, ensure_ascii=False, indent=2))
            other = driver.find_elements(By.ID, 'radHavePart_2')
            if other:
                other[0].click()
                time.sleep(0.5)
                wanted_brand = str(get_value(data, 'vehicle.brand') or '').strip()
                eclaim_refs = get_value(data, 'vehicle.eclaim_refs') or {}
                wanted_type_code = str(eclaim_refs.get('type_code') or 'E').strip()
                wanted_brand_code = str(eclaim_refs.get('brand_code') or '').strip()
                wanted_model_code = str(eclaim_refs.get('model_code') or '').strip()
                wanted_engine_size = str(eclaim_refs.get('engine_size') if eclaim_refs.get('engine_size') is not None else get_value(data, 'vehicle.engine_size') or '0').strip()
                type_select = driver.find_elements(By.ID, 'drpCVechTypeUnlisted')
                if type_select:
                    old_type = type_select[0]
                    Select(old_type).select_by_value(wanted_type_code)
                    try:
                        WebDriverWait(driver, 10).until(EC.staleness_of(old_type))
                    except Exception:
                        time.sleep(1)
                    driver.switch_to.default_content()
                    WebDriverWait(driver, 10).until(EC.frame_to_be_available_and_switch_to_it((By.ID, 'frame1')))
                    brand_select = driver.find_elements(By.ID, 'drpCmfgUnlisted')
                    brand_matches = [o for o in Select(brand_select[0]).options if (wanted_brand_code and o.get_attribute('value') == wanted_brand_code) or o.text.strip().casefold() == wanted_brand.casefold()] if brand_select else []
                    if not brand_matches:
                        report['skipped'].append({'field': 'vehicle_selector', 'source': 'vehicle.type/brand/model/year/trim', 'reason': f'No exact E-Claim selector option for brand: {wanted_brand}'})
                    else:
                        selection_ready = False
                        brand_control = brand_select[0]
                        Select(brand_control).select_by_value(brand_matches[0].get_attribute('value'))
                        try:
                            WebDriverWait(driver, 10).until(EC.staleness_of(brand_control))
                        except Exception:
                            time.sleep(0.8)
                        driver.switch_to.default_content()
                        WebDriverWait(driver, 10).until(EC.frame_to_be_available_and_switch_to_it((By.ID, 'frame1')))
                        model_controls = driver.find_elements(By.ID, 'drpCModelUnlisted')
                        model_wanted = str(get_value(data, 'vehicle.model') or '').strip()
                        if model_controls:
                            (Path(output_directory) / 'eclaim-model-options.json').write_text(json.dumps([{'text': o.text, 'value': o.get_attribute('value')} for o in Select(model_controls[0]).options], ensure_ascii=False, indent=2))
                        model_matches = [o for o in Select(model_controls[0]).options if (wanted_model_code and o.get_attribute('value') == wanted_model_code) or o.text.strip().casefold() == model_wanted.casefold()] if model_controls else []
                        if not model_matches and model_controls:
                            year_wanted = str(get_value(data, 'vehicle.year') or '').strip()
                            model_matches = [o for o in Select(model_controls[0]).options
                                             if model_wanted.casefold() in o.text.casefold()
                                             and (not year_wanted or year_wanted in o.text)]
                        if model_matches:
                            selection_ready = True
                            model_control = model_controls[0]
                            Select(model_control).select_by_value(model_matches[0].get_attribute('value'))
                            try:
                                WebDriverWait(driver, 10).until(EC.staleness_of(model_control))
                            except Exception:
                                time.sleep(0.8)
                            driver.switch_to.default_content()
                            WebDriverWait(driver, 10).until(EC.frame_to_be_available_and_switch_to_it((By.ID, 'frame1')))
                        else:
                            report['skipped'].append({'field': 'drpCModelUnlisted', 'source': 'vehicle.model', 'reason': f'No exact E-Claim model option: {model_wanted}'})
                        engine_controls = driver.find_elements(By.ID, 'drpEngsizeUnlisted')
                        if engine_controls:
                            engine_matches = [o for o in Select(engine_controls[0]).options if o.get_attribute('value') == wanted_engine_size or o.text.strip() == wanted_engine_size]
                            if engine_matches:
                                Select(engine_controls[0]).select_by_value(engine_matches[0].get_attribute('value'))
                        confirm = driver.find_elements(By.XPATH, "//*[self::input or self::button][@value='ยืนยันการเลือก' or normalize-space(.)='ยืนยันการเลือก']")
                        if confirm and selection_ready:
                            confirm[0].click()
                            time.sleep(1)
                        driver.switch_to.default_content()
                else:
                    # VIN lookup mode: choose make, enter chassis/model, then search.
                    vin_catalog = driver.find_elements(By.ID, 'drpCMFG2')
                    if vin_catalog:
                        wanted_brand = str(get_value(data, 'vehicle.brand') or '').strip()
                        brand_matches = [o for o in Select(vin_catalog[0]).options if o.text.strip().casefold() == wanted_brand.casefold()]
                        if brand_matches:
                            Select(vin_catalog[0]).select_by_value(brand_matches[0].get_attribute('value'))
                        chassis = driver.find_elements(By.ID, 'txtChassiNo')
                        model = driver.find_elements(By.ID, 'txtModel')
                        if chassis:
                            chassis[0].clear(); chassis[0].send_keys(str(get_value(data, 'vehicle.vin') or ''))
                        if model:
                            model[0].clear(); model[0].send_keys(str(get_value(data, 'vehicle.model') or ''))
                        search = driver.find_elements(By.ID, 'cmdCheckPic')
                        if search:
                            search[0].click()
                            time.sleep(1)
                        vin_result = driver.execute_script("return Array.from(document.querySelectorAll('input,select,button,a,div,table')).map(e=>({tag:e.tagName.toLowerCase(),id:e.id,type:e.type||'',value:e.value||'',text:(e.innerText||'').trim().slice(0,250),html:e.outerHTML.slice(0,1200)}));")
                        (Path(output_directory) / 'vehicle-vin-search.json').write_text(json.dumps(vin_result, ensure_ascii=False, indent=2))
                    # System catalogue mode: choose type, make, model, year and trim
                    # in order; each control performs an ASP.NET postback.
                    elif driver.find_elements(By.ID, 'drpCVechType'):
                        def selector_postback(field_id, wanted, source_path):
                            controls = driver.find_elements(By.ID, field_id)
                            if not controls:
                                report['skipped'].append({'field': field_id, 'source': source_path, 'reason': 'Selector control is not present'})
                                return False
                            control = controls[0]
                            matches = [o for o in Select(control).options if o.get_attribute('value') == str(wanted) or o.text.strip() == str(wanted)]
                            if len(matches) != 1:
                                report['skipped'].append({'field': field_id, 'source': source_path, 'reason': f'No exact selector option: {wanted}'})
                                return False
                            Select(control).select_by_value(matches[0].get_attribute('value'))
                            try:
                                WebDriverWait(driver, 12).until(EC.staleness_of(control))
                            except Exception:
                                time.sleep(0.8)
                            driver.switch_to.default_content()
                            WebDriverWait(driver, 12).until(EC.frame_to_be_available_and_switch_to_it((By.ID, 'frame1')))
                            return True

                        selector_postback('drpCVechType', 'E', 'vehicle.type (รถเก๋งยุโรป)')
                        selector_postback('drpCmfg', wanted_brand, 'vehicle.brand')
                        selector_postback('drpCModel', get_value(data, 'vehicle.model'), 'vehicle.model')
                        selector_postback('drpDstYear', get_value(data, 'vehicle.year'), 'vehicle.year')
                        trim = get_value(data, 'vehicle.trim')
                        trim_controls = driver.find_elements(By.ID, 'drpCTrimLevel')
                        if trim_controls:
                            trim_matches = [o for o in Select(trim_controls[0]).options if o.text.strip() == str(trim) or o.get_attribute('value') == str(trim)]
                            if len(trim_matches) == 1:
                                Select(trim_controls[0]).select_by_value(trim_matches[0].get_attribute('value'))
                        confirm = driver.find_elements(By.XPATH, "//*[self::input or self::button][@value='ยืนยันการเลือก' or normalize-space(.)='ยืนยันการเลือก']")
                        if confirm:
                            confirm[0].click()
                            time.sleep(1)
                        driver.switch_to.default_content()
                        for field_id, path in [('txtCType','vehicle.type'),('txtCMFG','vehicle.brand'),('txtCModel','vehicle.model'),('txtDSTYear','vehicle.year'),('txtCVechTyp','vehicle.trim')]:
                            target = str(get_value(data, path) or '').strip()
                            current = driver.find_elements(By.ID, field_id)
                            if current and target and current[0].get_attribute('value').strip() == target:
                                record(field_id, target, path)
                manual_controls = driver.execute_script("""
                  return Array.from(document.querySelectorAll('input,select,button,a,div,table')).map(e=>({tag:e.tagName.toLowerCase(),id:e.id,name:e.name||'',type:e.type||'',value:e.value||'',text:(e.innerText||'').trim().slice(0,300),html:e.outerHTML.slice(0,1500)}));
                """)
                (Path(output_directory) / 'vehicle-selector-manual.json').write_text(json.dumps(manual_controls, ensure_ascii=False, indent=2))
            driver.switch_to.default_content()
        driver.execute_script("var e=document.getElementById('frame_select'); if(e) e.style.display='none';")
        if driver.current_window_handle != base_handle and base_handle in driver.window_handles:
            driver.close()
            driver.switch_to.window(base_handle)

    def skip(field, source_path, reason):
        report['skipped'].append({'field': field, 'source': source_path, 'reason': reason})

    def record(field, value, source_path):
        expected[field] = str(value)
        report['filled'].append({'field': field, 'source': source_path, 'value': str(value)})
        time.sleep(delay)

    def text(field, value, source_path):
        if value is None or str(value).strip() == '':
            skip(field, source_path, 'No value in JSON')
            return
        try:
            e = driver.find_element(By.ID, field)
        except NoSuchElementException:
            skip(field, source_path, 'Field is not present in this E-Claim page version')
            return
        if not e.is_displayed() or not e.is_enabled() or e.get_attribute('readonly'):
            if field == 'wuCalendarContact_txtCalendar' and e.is_displayed() and e.get_attribute('readonly'):
                # The legacy calendar widget intentionally exposes a readonly input.
                # Set the visible value without enabling ordinary free-text writes.
                value = str(value).strip()
                try:
                    from datetime import datetime
                    parsed = datetime.strptime(value, '%Y-%m-%d')
                    value = parsed.strftime('%d/%m/') + str(parsed.year + 543)
                except ValueError:
                    pass
                maximum = int(e.get_attribute('maxlength') or -1)
                if maximum >= 0 and len(value) > maximum:
                    skip(field, source_path, 'Value exceeds field length; not truncated')
                    return
                driver.execute_script("""
                    const el = arguments[0], value = arguments[1];
                    el.value = value;
                    el.dispatchEvent(new Event('input', {bubbles:true}));
                    el.dispatchEvent(new Event('change', {bubbles:true}));
                """, e, value)
                assert e.get_attribute('value') == value, f'Value mismatch: {field}'
                record(field, value, source_path)
                return
            skip(field, source_path, 'Field is unavailable/read-only for this intake status')
            return
        value = str(value).strip()
        maximum = int(e.get_attribute('maxlength') or -1)
        if maximum >= 0 and len(value) > maximum:
            skip(field, source_path, 'Value exceeds field length; not truncated')
            return
        driver.execute_script('arguments[0].scrollIntoView({block:"center"})', e)
        e.clear()
        e.send_keys(value)
        assert e.get_attribute('value') == value, f'Value mismatch: {field}'
        record(field, value, source_path)

    def select_value(field, value, source_path):
        if value is None or str(value).strip() == '':
            skip(field, source_path, 'No value in JSON')
            return
        try:
            e = driver.find_element(By.ID, field)
        except NoSuchElementException:
            skip(field, source_path, 'Field is not present in this E-Claim page version')
            return
        if not e.is_displayed() or not e.is_enabled():
            skip(field, source_path, 'Field is unavailable for this intake status')
            return
        wanted = str(value).strip()
        options = Select(e).options
        matches = [o for o in options if o.get_attribute('value') == wanted or o.text.strip() == wanted]
        if len(matches) != 1:
            skip(field, source_path, 'No exact option match; values are never guessed')
            return
        Select(e).select_by_value(matches[0].get_attribute('value'))
        record(field, matches[0].get_attribute('value'), source_path)

    def radio(field, selected, source_path):
        if not selected:
            skip(field, source_path, 'No value in JSON')
            return
        try:
            e = driver.find_element(By.ID, field)
        except NoSuchElementException:
            skip(field, source_path, 'Field is not present in this E-Claim page version')
            return
        if not e.is_displayed() or not e.is_enabled():
            skip(field, source_path, 'Field is unavailable for this intake status')
            return
        if not e.is_selected():
            e.click()
        assert e.is_selected()
        report['filled'].append({'field': field, 'source': source_path, 'value': True})
        time.sleep(delay)

    def checkbox(field, checked, source_path):
        try:
            e = driver.find_element(By.ID, field)
        except NoSuchElementException:
            skip(field, source_path, 'Field is not present in this E-Claim page version')
            return
        if not e.is_displayed() or not e.is_enabled():
            skip(field, source_path, 'Field is unavailable for this intake status')
            return
        if bool(checked) != e.is_selected():
            e.click()
        assert e.is_selected() == bool(checked)
        report['filled'].append({'field': field, 'source': source_path, 'value': bool(checked)})
        time.sleep(delay)

    # Only these UI selections may cause a postback; the guard blocks saving.
    insurer = str(get_value(data, 'insurance.name') or get_value(data, 'customer.payment') or '').strip()
    # insurance.code is Rizenic's internal master code (for example INS-01),
    # not necessarily the numeric E-Claim option value. Only use an explicit
    # E-Claim reference; otherwise resolve by exact visible option name.
    insurer_id = insurer_override or get_value(data, 'eclaim.insurer_id') or get_value(data, 'eclaim.insurer_code')
    insurer_control = driver.find_element(By.ID, 'ddlInsurer')
    options = Select(insurer_control).options
    matches = [o for o in options if o.text.strip() == insurer]
    if insurer_id not in (None, ''):
        matches = [o for o in options if o.get_attribute('value') == str(insurer_id)]
    if len(matches) != 1:
        raise AssertionError('Insurer is missing/ambiguous. Supply eclaim.insurer_id; no values guessed')
    value = matches[0].get_attribute('value')
    if insurer_control.get_attribute('value') != value:
        Select(insurer_control).select_by_value(value)
        WebDriverWait(driver, 30).until(EC.staleness_of(insurer_control))
        WebDriverWait(driver, 30).until(EC.element_to_be_clickable((By.ID, 'txtCarRegNo')))
    record('ddlInsurer', value, 'customer.payment / eclaim.insurer_id')

    parked = get_value(data, 'workflow.park_status')
    if parked in ('จอดซ่อม', 'ไม่จอดซ่อม'):
        field = 'rbStatusCar_0' if parked == 'จอดซ่อม' else 'rbStatusCar_1'
        e = driver.find_element(By.ID, field)
        if not e.is_selected():
            e.click()
            WebDriverWait(driver, 30).until(EC.staleness_of(e))
            WebDriverWait(driver, 30).until(EC.presence_of_element_located((By.ID, field)))
        assert driver.find_element(By.ID, field).is_selected()
        report['filled'].append({'field': field, 'source': 'workflow.park_status', 'value': parked})
    else:
        skip('rbStatusCar', 'workflow.park_status', 'Missing or unknown parking status')

    for field, source_path in TEXT_MAPPING.items():
        text(field, get_value(data, source_path), source_path)

    # Explicit controls required by the legacy E-Claim page.
    select_value('ddlTypeRepair', get_value(data, 'repair.type'), 'repair.type')
    parts_value = get_value(data, 'repair.has_parts')
    if parts_value is not None:
        radio('rbPart_0' if bool(parts_value) else 'rbPart_1', True, 'repair.has_parts')
    else:
        skip('rbPart', 'repair.has_parts', 'No value in JSON')
    labor_amount = get_value(data, 'repair.labor_amount')
    if labor_amount not in (None, ''):
        text('txtEstimateLabor', labor_amount, 'repair.labor_amount')
    else:
        skip('txtEstimateLabor', 'repair.labor_amount', 'No value in JSON')

    fuel = str(get_value(data, 'intake.fuel_level') or '').strip().upper()
    fuel_ids = {'E': 'rbOil_0', '1/4': 'rbOil_1', '1/2': 'rbOil_2', '3/4': 'rbOil_3', 'F': 'rbOil_4'}
    if fuel in fuel_ids:
        radio(fuel_ids[fuel], True, 'intake.fuel_level')
    else:
        skip('rbOil', 'intake.fuel_level', 'Expected E, 1/4, 1/2, 3/4 or F')
    equipment = get_value(data, 'intake.equipment') or {}
    for key, field in [('jack', 'cblItemCarRepair_0'), ('floor_mat', 'cblItemCarRepair_1'),
                       ('wheel_cover', 'cblItemCarRepair_2'), ('spare_tire', 'cblItemCarRepair_3'),
                       ('radio', 'cbRadio')]:
        checkbox(field, equipment.get(key) is True, f'intake.equipment.{key}')
    other = equipment.get('other')
    if other not in (None, ''):
        checkbox('cbOther', True, 'intake.equipment.other')
        text('txtOtherDesc', other, 'intake.equipment.other')

    damage_level = get_value(data, 'workflow.damage_level')
    if damage_level not in (None, ''):
        text('txtLossOther', damage_level, 'workflow.damage_level')

    # Delivery controls are enabled only after the legacy workflow reaches delivery.
    # We still attempt them from the same JSON so the report clearly identifies
    # fields that are unavailable in an earlier status.
    delivery_result = get_value(data, 'delivery.repair_result')
    if delivery_result in (0, '0', 'สภาพรถเรียบร้อย'):
        radio('rbCommentGetcar_0', True, 'delivery.repair_result')
    elif delivery_result in (1, '1', 'รถซ่อมไม่เรียบร้อยพบปัญหา'):
        radio('rbCommentGetcar_1', True, 'delivery.repair_result')
    else:
        skip('rbCommentGetcar', 'delivery.repair_result', 'No exact result value in JSON')
    inventory_complete = get_value(data, 'delivery.inventory_complete')
    if inventory_complete in (0, '0', 'ครบ'):
        radio('rbItemGetcar_0', True, 'delivery.inventory_complete')
    elif inventory_complete in (1, '1', 'ไม่ครบ'):
        radio('rbItemGetcar_1', True, 'delivery.inventory_complete')
    else:
        skip('rbItemGetcar', 'delivery.inventory_complete', 'No exact inventory value in JSON')

    province = get_value(data, 'eclaim.province')
    province_code = get_value(data, 'eclaim.province_code') or get_value(data, 'vehicle.plate_province_code')
    province = 'กรุงเทพ ฯ' if province == 'กรุงเทพมหานคร' else province
    e = driver.find_element(By.ID, 'ddlCarRegProvince')
    if province_code not in (None, ''):
        matches = [o for o in Select(e).options if o.get_attribute('value') == str(province_code)]
        province_source = 'eclaim.province_code'
    else:
        matches = [o for o in Select(e).options if o.text.strip() == province]
        province_source = 'eclaim.province'
    if len(matches) == 1 and e.is_enabled():
        value = matches[0].get_attribute('value')
        Select(e).select_by_value(value)
        record('ddlCarRegProvince', value, province_source)
    else:
        skip('ddlCarRegProvince', province_source, 'No exact available province match')

    for field, source_path, reason in [
        ('vehicle_catalog', 'vehicle.brand/model; eclaim.trim/car_type', 'Needs an exact vehicle catalogue selection; read-only vehicle labels are not overwritten'),
        ('inventory', 'inspection.inventory', 'Unknown inventory values are not converted to absent'),
        ('dates', 'dates', 'System dates and calendar-controlled fields left unchanged; appointment versus actual dates must not be conflated'),
        ('repair_items', 'repair.parts; eclaim.items', 'Intake page has no itemized parts or estimate table'),
        ('documents', 'documents.qt_no/so_no/bl_no', 'No matching fields on intake page'),
        ('notes', 'workflow.notes', 'Other damage field explicitly excludes repair items; general notes do not have a matching field'),
    ]:
        skip(field, source_path, reason)

    for field, value in expected.items():
        assert driver.find_element(By.ID, field).get_attribute('value') == value, f'Final value mismatch: {field}'
    assert driver.execute_script('return window.__robotNoSave === true')
    assert not driver.find_element(By.ID, 'bntSave').is_enabled()
    assert driver.execute_script('return window.__robotBlockedSaves || 0') == 0, 'A save was attempted and blocked'
    output = Path(output_directory)
    output.mkdir(parents=True, exist_ok=True)
    (output / 'intake-fill-report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
    driver.execute_script('window.scrollTo(0,0)')
    driver.save_screenshot(str(output / 'intake-filled-unsaved.png'))
    logger.console(f'Filled and verified {len(report["filled"])} fields; no save attempted. See intake-fill-report.json for missing/unmapped data.')
    return report
