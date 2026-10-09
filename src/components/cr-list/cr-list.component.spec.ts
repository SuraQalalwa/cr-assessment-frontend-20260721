import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CrListComponent } from './cr-list.component';
import { SessionService } from '../../session/session.service';
import { users } from '../../api/fixtures';
import { ReqUser } from '../../models/cr.models';
import { CrApiService } from '../../api/cr-api.service';

const flush = () => new Promise((r) => setTimeout(r, 0));

async function render(user: ReqUser): Promise<ComponentFixture<CrListComponent>> {
	TestBed.configureTestingModule({
		imports: [CrListComponent],
		providers: [{ provide: SessionService, useValue: { user } }],
	});
	await TestBed.compileComponents();
	const fixture = TestBed.createComponent(CrListComponent);
	fixture.detectChanges(); // ngOnInit -> load()
	await flush(); // let the mock API resolve
	fixture.detectChanges(); // render the loaded/empty state
	return fixture;
}

describe('CrListComponent', () => {
	it('renders a row per change request in the user org', async () => {
		const fixture = await render(users.approver);
		expect(fixture.nativeElement.querySelectorAll('.cr-list__row').length).toBe(3); // org-alpha: CR-1, CR-2, CR-3
	});

	it('shows the empty state when the org has no change requests', async () => {
		const fixture = await render({ id: 'x', orgCode: 'org-empty', policies: ['cr_r_o'] });
		expect(fixture.nativeElement.querySelector('.cr-list__empty')).not.toBeNull();
		expect(fixture.nativeElement.querySelector('.cr-list__table')).toBeNull();
	});

	it('filters rows by status when status filter changes', async () => {
		const fixture = await render(users.approver);
		fixture.componentInstance.onFilterChange('PENDING_APPROVAL');
		fixture.detectChanges();
		const rows = fixture.nativeElement.querySelectorAll('.cr-list__row');
		expect(rows.length).toBe(1);
		expect(rows[0].textContent).toContain('CR-1');

		fixture.componentInstance.onFilterChange('ALL');
		fixture.detectChanges();
		expect(fixture.nativeElement.querySelectorAll('.cr-list__row').length).toBe(3);
	});

	it('emits select event with CR id when a row is clicked', async () => {
		const fixture = await render(users.approver);
		const spy = jest.spyOn(fixture.componentInstance.select, 'emit');

		const firstRow: HTMLTableRowElement = fixture.nativeElement.querySelector('.cr-list__row');
		firstRow.click();

		expect(spy).toHaveBeenCalledWith('CR-1');
	});

	it('renders error state and retries successfully when load fails', async () => {
		const fixture = await render(users.approver);
		const api = TestBed.inject(CrApiService);
		api.failNext = true;

		await fixture.componentInstance.load();
		fixture.detectChanges();

		expect(fixture.nativeElement.querySelector('.cr-list__error')).not.toBeNull();
		expect(fixture.nativeElement.querySelector('.cr-list__error p').textContent).toContain('Network error');

		// Click retry
		const retryBtn: HTMLButtonElement = fixture.nativeElement.querySelector('.cr-list__error button');
		retryBtn.click();
		await flush();
		fixture.detectChanges();

		expect(fixture.nativeElement.querySelector('.cr-list__error')).toBeNull();
		expect(fixture.nativeElement.querySelectorAll('.cr-list__row').length).toBe(3);
	});
});
