import { SimpleChange } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CrDetailComponent } from './cr-detail.component';
import { SessionService } from '../../session/session.service';
import { users } from '../../api/fixtures';
import { ReqUser } from '../../models/cr.models';
import { CrApiService } from '../../api/cr-api.service';

const flush = () => new Promise((r) => setTimeout(r, 0));

async function render(user: ReqUser, id: string): Promise<ComponentFixture<CrDetailComponent>> {
	TestBed.configureTestingModule({
		imports: [CrDetailComponent],
		providers: [{ provide: SessionService, useValue: { user } }],
	});
	await TestBed.compileComponents();
	const fixture = TestBed.createComponent(CrDetailComponent);
	fixture.componentInstance.id = id;
	fixture.detectChanges(); // ngOnInit -> load()
	await flush(); // let the mock API resolve
	fixture.detectChanges(); // render the loaded state
	return fixture;
}

describe('CrDetailComponent', () => {
	it('loads and renders the change request title', async () => {
		const fixture = await render(users.approver, 'CR-1');
		expect(fixture.nativeElement.querySelector('.cr-detail__header h2').textContent).toContain('Add 1 unit of SKU-A');
	});

	it('disables Approve for a read-only viewer on a pending CR', async () => {
		const fixture = await render(users.viewer, 'CR-1'); // viewer: cr_r_o only; CR-1 is PENDING_APPROVAL
		const approveBtn: HTMLButtonElement = fixture.nativeElement.querySelector('.cr-actions__approve');
		expect(approveBtn.disabled).toBe(true);
	});

	it('renders timeline entries chronologically (oldest first)', async () => {
		// 1. Render component with audit history
		const fixture = await render(users.approver, 'CR-1');

		// 2. Extract rendered action names from DOM
		const entries = fixture.nativeElement.querySelectorAll('.cr-timeline__entry .cr-timeline__action');
		const actions = Array.from(entries).map((el: any) => el.textContent.trim());

		// 3. Verify entries are sorted chronologically (oldest to newest)
		expect(actions).toEqual(['CREATE', 'SUBMIT', 'SEND_FOR_APPROVAL']);
	});

	it('disables Reject until a non-empty reason is entered', async () => {
		const fixture = await render(users.approver, 'CR-1');
		const rejectBtn: HTMLButtonElement = fixture.nativeElement.querySelector('.cr-actions__reject-btn');
		// 1. Initially disabled when empty
		expect(rejectBtn.disabled).toBe(true);

		// 2. Spaces only should keep it invalid
		fixture.componentInstance.rejectControl.setValue('   ');
		fixture.componentInstance.rejectControl.markAsTouched();
		fixture.detectChanges();
		expect(rejectBtn.disabled).toBe(true);
		expect(fixture.nativeElement.querySelector('.cr-actions__reason-error')).not.toBeNull();

		// 3. Shorter than 5 characters
		fixture.componentInstance.rejectControl.setValue('No');
		fixture.detectChanges();
		expect(rejectBtn.disabled).toBe(true);
		expect(fixture.nativeElement.querySelector('.cr-actions__reason-error')).not.toBeNull();

		// 4. Meaningful reason (>= 5 chars) enables the button and clears the error
		fixture.componentInstance.rejectControl.setValue('Price exceeds threshold');
		fixture.detectChanges();
		expect(rejectBtn.disabled).toBe(false);
		expect(fixture.nativeElement.querySelector('.cr-actions__reason-error')).toBeNull();
	});

	it('successfully approves the change request and updates view state', async () => {
		const fixture = await render(users.approver, 'CR-1');
		const approveBtn: HTMLButtonElement = fixture.nativeElement.querySelector('.cr-actions__approve');

		// 1. Initially: Approve button is enabled for approver
		expect(approveBtn.disabled).toBe(false);

		// 2. Execute approve action and trigger change detection
		await fixture.componentInstance.approve();
		fixture.detectChanges();

		// 3. Verify status transitions to APPROVED in component state and DOM
		expect(fixture.componentInstance.detail?.status).toBe('APPROVED');
		expect(fixture.nativeElement.querySelector('.cr-status').textContent).toContain('APPROVED');

		// 4. Verify action buttons become disabled once approved
		expect(fixture.componentInstance.canApprove).toBe(false);
		expect(approveBtn.disabled).toBe(true);
	});

	it('handles failure when approve API rejects and displays error', async () => {
		const fixture = await render(users.approver, 'CR-1');

		// 1. Simulate a network failure on the next API call
		const api = TestBed.inject(CrApiService);
		api.failNext = true;

		// 2. Attempt approval and trigger change detection
		await fixture.componentInstance.approve();
		fixture.detectChanges();

		// 3. Verify inline error banner appears with network error message
		expect(fixture.componentInstance.actionError).toBe('Network error');
		expect(fixture.nativeElement.querySelector('.cr-actions__error').textContent).toContain('Network error');

		// 4. Verify submitting state resets to false so user is not locked out
		expect(fixture.componentInstance.submitting).toBe(false);
	});

	it('successfully rejects the change request and updates view state', async () => {
		const fixture = await render(users.approver, 'CR-1');

		// 1. Provide a valid rejection reason
		fixture.componentInstance.rejectControl.setValue('Budget exceeded for this quarter');
		fixture.detectChanges();

		// 2. Execute reject action and trigger change detection
		await fixture.componentInstance.reject();
		fixture.detectChanges();

		// 3. Verify status transitions to REJECTED in component state and DOM
		expect(fixture.componentInstance.detail?.status).toBe('REJECTED');
		expect(fixture.nativeElement.querySelector('.cr-status').textContent).toContain('REJECTED');

		// 4. Verify rejection panel is hidden now that CR is no longer pending
		expect(fixture.componentInstance.canReject).toBe(false);
		expect(fixture.nativeElement.querySelector('.cr-actions__reject')).toBeNull();
	});

	it('handles failure when reject API rejects and displays error', async () => {
		const fixture = await render(users.approver, 'CR-1');

		// 1. Provide a valid rejection reason
		fixture.componentInstance.rejectControl.setValue('Budget exceeded');
		fixture.detectChanges();

		// 2. Simulate a network failure on the next API call
		const api = TestBed.inject(CrApiService);
		api.failNext = true;

		// 3. Attempt rejection and trigger change detection
		await fixture.componentInstance.reject();
		fixture.detectChanges();

		// 4. Verify inline error banner displays network error
		expect(fixture.componentInstance.actionError).toBe('Network error');
		expect(fixture.nativeElement.querySelector('.cr-actions__error').textContent).toContain('Network error');

		// 5. Verify submitting state resets to false
		expect(fixture.componentInstance.submitting).toBe(false);
	});

	it('renders diff panel with totals, delta, and line-item changes', async () => {
		const fixture = await render(users.approver, 'CR-1');

		// 1. Verify before/after totals and delta currency formatting in header
		expect(fixture.nativeElement.querySelector('.cr-detail__totals').textContent).toContain('USD 8,000.00 → USD 8,500.00');
		expect(fixture.nativeElement.querySelector('.cr-detail__delta').textContent).toContain('Δ USD 500.00');

		// 2. Verify diff table rows exist for all line items
		const rows = fixture.nativeElement.querySelectorAll('.cr-diff__row');
		expect(rows.length).toBe(2);

		// 3. Verify changed vs unchanged classification badges in the DOM
		expect(rows[0].querySelector('.cr-diff__kind').textContent).toBe('changed');
		expect(rows[1].querySelector('.cr-diff__kind').textContent).toBe('unchanged');
	});

	it('reloads when input id changes', async () => {
		// 1. Initial render loads CR-1
		const fixture = await render(users.approver, 'CR-1');
		expect(fixture.nativeElement.querySelector('.cr-detail__header h2').textContent).toContain('Add 1 unit of SKU-A');

		// 2. Simulate parent selecting CR-2 and triggering ngOnChanges
		fixture.componentInstance.id = 'CR-2';
		fixture.componentInstance.ngOnChanges({
			id: new SimpleChange('CR-1', 'CR-2', false),
		});
		await flush();
		fixture.detectChanges();

		// 3. Verify detail view reloads with CR-2 content
		expect(fixture.nativeElement.querySelector('.cr-detail__header h2').textContent).toContain('Replace SKU-B supplier');
	});

	it('renders error state and retries successfully when load fails', async () => {
		const fixture = await render(users.approver, 'CR-1');

		// 1. Simulate network failure during initial load
		const api = TestBed.inject(CrApiService);
		api.failNext = true;

		await fixture.componentInstance.load();
		fixture.detectChanges();

		// 2. Verify full-page error banner appears with network error
		expect(fixture.nativeElement.querySelector('.cr-detail__error')).not.toBeNull();
		expect(fixture.nativeElement.querySelector('.cr-detail__error p').textContent).toContain('Network error');

		// 3. Click the Retry button to re-attempt loading
		const retryBtn: HTMLButtonElement = fixture.nativeElement.querySelector('.cr-detail__error button');
		retryBtn.click();
		await flush();
		fixture.detectChanges();

		// 4. Verify error banner is removed and change request details load successfully
		expect(fixture.nativeElement.querySelector('.cr-detail__error')).toBeNull();
		expect(fixture.nativeElement.querySelector('.cr-detail__header h2').textContent).toContain('Add 1 unit of SKU-A');
	});
});
