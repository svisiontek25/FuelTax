"""
FuelTaxPulse IFTA & State Adjacency Compliance Engine
Exact mathematical replica of ProMiles FuelTaxOnline specifications.
"""

from typing import List, Dict, Tuple, Optional
from collections import deque
from decimal import Decimal, ROUND_HALF_UP

def round_half_up(val: float, places: int = 2) -> float:
    """Standard commercial round-half-up (avoids banker's rounding discrepancies)."""
    d = Decimal(str(val))
    target = Decimal("1." + "0" * places) if places > 0 else Decimal("1")
    return float(d.quantize(target, rounding=ROUND_HALF_UP))

# -----------------------------------------------------------------------------
# 1. BORDER ADJACENCY MATRIX (US Lower 48 + Canadian border provinces)
# -----------------------------------------------------------------------------
STATE_ADJACENCY = {
    # Lower 48 US States + DC
    "AL": ["FL", "GA", "MS", "TN"],
    "AZ": ["CA", "CO", "NM", "NV", "UT"],
    "AR": ["LA", "MO", "MS", "OK", "TN", "TX"],
    "CA": ["AZ", "NV", "OR"],
    "CO": ["AZ", "KS", "NE", "NM", "OK", "UT", "WY"],
    "CT": ["MA", "NY", "RI"],
    "DE": ["MD", "NJ", "PA"],
    "DC": ["MD", "VA"],
    "FL": ["AL", "GA"],
    "GA": ["AL", "FL", "NC", "SC", "TN"],
    "ID": ["MT", "NV", "OR", "UT", "WA", "WY", "BC"],
    "IL": ["IA", "IN", "KY", "MO", "WI"],
    "IN": ["IL", "KY", "MI", "OH"],
    "IA": ["IL", "MN", "MO", "NE", "SD", "WI"],
    "KS": ["CO", "MO", "NE", "OK"],
    "KY": ["IL", "IN", "MO", "OH", "TN", "VA", "WV"],
    "LA": ["AR", "MS", "TX"],
    "ME": ["NH", "NB", "QC"],
    "MD": ["DC", "DE", "PA", "VA", "WV"],
    "MA": ["CT", "NH", "NY", "RI", "VT"],
    "MI": ["IN", "OH", "WI", "ON"],
    "MN": ["IA", "ND", "SD", "WI", "MB", "ON"],
    "MS": ["AL", "AR", "LA", "TN"],
    "MO": ["AR", "IA", "IL", "KS", "KY", "NE", "OK", "TN"],
    "MT": ["ID", "ND", "SD", "WY", "AB", "BC", "SK"],
    "NE": ["CO", "IA", "KS", "MO", "SD", "WY"],
    "NV": ["AZ", "CA", "ID", "OR", "UT"],
    "NH": ["MA", "ME", "VT", "QC"],
    "NJ": ["DE", "NY", "PA"],
    "NM": ["AZ", "CO", "OK", "TX"],
    "NY": ["CT", "MA", "NJ", "PA", "VT", "ON", "QC"],
    "NC": ["GA", "SC", "TN", "VA"],
    "ND": ["MN", "MT", "SD", "MB", "SK"],
    "OH": ["IN", "KY", "MI", "PA", "WV"],
    "OK": ["AR", "CO", "KS", "MO", "NM", "TX"],
    "OR": ["CA", "ID", "NV", "WA"],
    "PA": ["DE", "MD", "NJ", "NY", "OH", "WV"],
    "RI": ["CT", "MA"],
    "SC": ["GA", "NC"],
    "SD": ["IA", "MN", "MT", "ND", "NE", "WY"],
    "TN": ["AL", "AR", "GA", "KY", "MO", "MS", "NC", "VA"],
    "TX": ["AR", "LA", "NM", "OK"],
    "UT": ["AZ", "CO", "ID", "NV", "WY"],
    "VT": ["MA", "NH", "NY", "QC"],
    "VA": ["DC", "KY", "MD", "NC", "TN", "WV"],
    "WA": ["ID", "OR", "BC"],
    "WV": ["KY", "MD", "OH", "PA", "VA"],
    "WI": ["IL", "IA", "MI", "MN"],
    "WY": ["CO", "ID", "MT", "NE", "SD", "UT"],
    # Canadian Provinces
    "BC": ["WA", "ID", "MT", "AB", "YT"],
    "AB": ["BC", "MT", "SK", "NT"],
    "SK": ["AB", "MB", "MT", "ND"],
    "MB": ["SK", "ON", "ND", "MN"],
    "ON": ["MB", "QC", "MN", "MI", "NY"],
    "QC": ["ON", "NB", "NY", "VT", "NH", "ME"],
    "NB": ["QC", "ME", "NS"]
}

def are_adjacent(j1: str, j2: str) -> bool:
    """Check if two jurisdictions share a direct land border."""
    if j1 == j2:
        return True
    return j2 in STATE_ADJACENCY.get(j1, [])

def find_shortest_connecting_path(start: str, end: str) -> Optional[List[str]]:
    """BFS to discover the missing corridor if two states in a trip are not adjacent."""
    if start == end:
        return [start]
    visited = {start}
    queue = deque([[start]])
    while queue:
        path = queue.popleft()
        current = path[-1]
        for neighbor in STATE_ADJACENCY.get(current, []):
            if neighbor == end:
                return path + [neighbor]
            if neighbor not in visited:
                visited.add(neighbor)
                queue.append(path + [neighbor])
    return None

def validate_trip_route(jurisdictions: List[str]) -> Dict:
    """
    Validates sequential trip segments against state adjacency.
    Returns validation status, list of issues, and suggested intermediate states.
    """
    if len(jurisdictions) <= 1:
        return {"valid": True, "errors": []}

    errors = []
    for i in range(len(jurisdictions) - 1):
        j_curr = jurisdictions[i]
        j_next = jurisdictions[i+1]
        if not are_adjacent(j_curr, j_next):
            path = find_shortest_connecting_path(j_curr, j_next)
            suggested = path[1:-1] if path else []
            errors.append({
                "segment_index": i,
                "from": j_curr,
                "to": j_next,
                "message": f"Non-adjacent state jump: '{j_curr}' to '{j_next}' without recorded border crossing.",
                "suggested_intermediate_states": suggested
            })

    return {
        "valid": len(errors) == 0,
        "errors": errors
    }

# -----------------------------------------------------------------------------
# 2. IFTA & WEIGHT-DISTANCE CALCULATION ENGINE
# -----------------------------------------------------------------------------

class IFTAEngine:
    def __init__(self, tax_rates: Dict[str, Dict]):
        """
        tax_rates format:
        {
           'AR': {'rate': 0.2850, 'surcharge': 0.0, 'mile_tax_rate': 0.0},
           'KY': {'rate': 0.2200, 'surcharge': 0.1050, 'mile_tax_rate': 0.0285},
           'NM': {'rate': 0.2100, 'surcharge': 0.0, 'mile_tax_rate': 0.04378},
           ...
        }
        """
        self.tax_rates = tax_rates

    def calculate_fleet_summary(self, 
                                company_name: str,
                                period: str,
                                total_units: int,
                                fuel_type: str,
                                state_data: List[Dict]) -> Dict:
        """
        Calculates exact Fleet Fuel Tax Summary table replicating ProMiles FuelTaxOnline.
        state_data item format:
        {
           'state': 'AR',
           'all_miles': 70452,
           'non_toll_miles': 70452,
           'toll_miles': 0,
           'thruway_toll_miles': 0,
           'permitted_miles': 0,
           'off_road_miles': 0,
           'taxable_miles': 70452,
           'all_gallons': 10672,
           'non_tax_paid_gallons': 0,
           'tax_paid_gallons': 10672,
           'interest': 0.0
        }
        """
        # Step 1: Compute Fleet Totals
        total_fleet_miles = sum(row.get('taxable_miles', row.get('all_miles', 0)) for row in state_data)
        total_fleet_fuel = sum(row.get('tax_paid_gallons', 0) for row in state_data)

        if total_fleet_fuel > 0:
            fleet_mpg = round_half_up(total_fleet_miles / total_fleet_fuel, 2)
        else:
            fleet_mpg = 0.0

        rows = []
        tot_all_miles = 0
        tot_non_toll = 0
        tot_toll = 0
        tot_thruway = 0
        tot_permitted = 0
        tot_off_road = 0
        tot_taxable_miles = 0
        tot_all_gallons = 0
        tot_non_tax_paid_gallons = 0
        tot_tax_paid_gallons = 0
        tot_taxable_gallons = 0
        tot_net_taxable_gallons = 0
        tot_interest = 0.0
        tot_ifta_due = 0.0
        tot_mile_tax_due = 0.0
        audit_warnings = []

        # Sort states alphabetically
        sorted_state_data = sorted(state_data, key=lambda x: x['state'])

        for row in sorted_state_data:
            state = row['state']
            all_miles = row.get('all_miles', 0)
            non_toll = row.get('non_toll_miles', all_miles)
            toll = row.get('toll_miles', 0)
            thruway = row.get('thruway_toll_miles', 0)
            permitted = row.get('permitted_miles', 0)
            off_road = row.get('off_road_miles', 0)
            taxable_miles = row.get('taxable_miles', all_miles - off_road)

            all_gal = row.get('all_gallons', 0)
            non_tax_gal = row.get('non_tax_paid_gallons', 0)
            tax_paid_gal = row.get('tax_paid_gallons', all_gal - non_tax_gal)
            interest = row.get('interest', 0.0)

            # Audit checks
            if tax_paid_gal > 0 and taxable_miles == 0:
                audit_warnings.append({
                    "jurisdiction": state,
                    "type": "GHOST_FUEL",
                    "message": f"{state}: {tax_paid_gal:.1f} gallons purchased but 0 miles recorded."
                })
            elif taxable_miles > 500 and tax_paid_gal == 0:
                audit_warnings.append({
                    "jurisdiction": state,
                    "type": "GHOST_MILES",
                    "message": f"{state}: {taxable_miles:,} miles logged with $0.00 tax-paid fuel purchased."
                })

            # ProMiles standard rounding rule:
            # Taxable gallons = round_half_up(taxable_miles / fleet_mpg, 0)
            if fleet_mpg > 0:
                taxable_gal = int(round_half_up(taxable_miles / fleet_mpg, 0))
            else:
                taxable_gal = 0

            net_taxable_gal = taxable_gal - tax_paid_gal

            rates = self.tax_rates.get(state, {'rate': 0.0, 'surcharge': 0.0, 'mile_tax_rate': 0.0})
            tax_rate = rates.get('rate', 0.0)
            surcharge_rate = rates.get('surcharge', 0.0)
            mile_rate = rates.get('mile_tax_rate', 0.0)

            # Primary IFTA row
            ifta_due = round_half_up(net_taxable_gal * tax_rate, 2)

            # Weight-distance mile tax (e.g., KY KYU, NM WDT, NY HUT, OR)
            mile_tax_due = round_half_up(taxable_miles * mile_rate, 2) if mile_rate > 0 else 0.0

            rows.append({
                "state": state,
                "is_surcharge_row": False,
                "all_miles": all_miles,
                "non_toll_miles": non_toll,
                "toll_miles": toll,
                "thruway_toll_miles": thruway,
                "permitted_miles": permitted,
                "off_road_miles": off_road,
                "taxable_miles": taxable_miles,
                "all_gallons": all_gal,
                "non_tax_paid_gallons": non_tax_gal,
                "tax_paid_gallons": tax_paid_gal,
                "taxable_gallons": taxable_gal,
                "net_taxable_gallons": net_taxable_gal,
                "tax_rate": f"{tax_rate:.4f}",
                "interest": f"{interest:.2f}",
                "ifta_tax_due": ifta_due,
                "approx_mile_tax_due": f"{mile_tax_due:.2f}" if mile_tax_due > 0 else ""
            })

            tot_all_miles += all_miles
            tot_non_toll += non_toll
            tot_toll += toll
            tot_thruway += thruway
            tot_permitted += permitted
            tot_off_road += off_road
            tot_taxable_miles += taxable_miles
            tot_all_gallons += all_gal
            tot_non_tax_paid_gallons += non_tax_gal
            tot_tax_paid_gallons += tax_paid_gal
            tot_taxable_gallons += taxable_gal
            tot_net_taxable_gallons += net_taxable_gal
            tot_interest += interest
            tot_ifta_due += ifta_due
            tot_mile_tax_due += mile_tax_due

            # Special case: KY heavy fuel surcharge row
            if surcharge_rate > 0 and state == 'KY':
                surch_taxable_gal = taxable_gal
                surch_due = round_half_up(surch_taxable_gal * surcharge_rate, 2)
                rows.append({
                    "state": "KY",
                    "is_surcharge_row": True,
                    "all_miles": "",
                    "non_toll_miles": "",
                    "toll_miles": "",
                    "thruway_toll_miles": "",
                    "permitted_miles": "",
                    "off_road_miles": "",
                    "taxable_miles": "",
                    "all_gallons": "",
                    "non_tax_paid_gallons": "",
                    "tax_paid_gallons": "",
                    "taxable_gallons": surch_taxable_gal,
                    "net_taxable_gallons": "",
                    "tax_rate": f"{surcharge_rate:.4f}",
                    "interest": "0.00",
                    "ifta_tax_due": surch_due,
                    "approx_mile_tax_due": ""
                })
                tot_ifta_due += surch_due

        total_due = round_half_up(tot_ifta_due + tot_mile_tax_due + tot_interest, 2)

        return {
            "metadata": {
                "company_name": company_name,
                "period": period,
                "total_units": total_units,
                "trip_count": total_units,
                "fuel_type": fuel_type,
                "total_miles": tot_all_miles,
                "total_fuel": tot_tax_paid_gallons,
                "fleet_mpg": fleet_mpg,
                "total_ifta_due": round(tot_ifta_due, 2),
                "total_mile_tax_due": round(tot_mile_tax_due, 2),
                "total_due": total_due,
                "audit_warnings": audit_warnings
            },
            "rows": rows,
            "totals": {
                "state": "Totals",
                "all_miles": tot_all_miles,
                "non_toll_miles": tot_non_toll,
                "toll_miles": tot_toll,
                "thruway_toll_miles": tot_thruway,
                "permitted_miles": tot_permitted,
                "off_road_miles": tot_off_road,
                "taxable_miles": tot_taxable_miles,
                "all_gallons": tot_all_gallons,
                "non_tax_paid_gallons": tot_non_tax_paid_gallons,
                "tax_paid_gallons": tot_tax_paid_gallons,
                "taxable_gallons": tot_taxable_gallons,
                "net_taxable_gallons": tot_net_taxable_gallons,
                "tax_rate": "",
                "interest": f"{tot_interest:.2f}",
                "ifta_tax_due": f"{tot_ifta_due:.2f}",
                "approx_mile_tax_due": f"{tot_mile_tax_due:.2f}"
            }
        }
