import type { SupportedCountryCode } from '../data/supportedCountries';
import { isSupportedCountry } from '../data/supportedCountries';

export interface RegionalTaxProfile {
  countryCode: SupportedCountryCode;
  countryName: string;
  currencyHint: string;
  /** Headline VAT / sales tax rate for hospitality (display). */
  standardVatPercent: number;
  reducedVatPercent?: number;
  vatLabel: string;
  incomeTaxSummary: string;
  municipalTaxSummary: string;
  socialSecuritySummary: string;
  defaultMunicipalTaxRate: number;
  disclaimer: string;
}

const PROFILES: Record<SupportedCountryCode, RegionalTaxProfile> = {
  GB: {
    countryCode: 'GB',
    countryName: 'United Kingdom',
    currencyHint: 'GBP (£)',
    standardVatPercent: 20,
    reducedVatPercent: 0,
    vatLabel: 'VAT (Value Added Tax)',
    incomeTaxSummary:
      'Personal allowance then progressive bands (basic / higher / additional). Rates depend on nation (England, Wales, Scotland, NI).',
    municipalTaxSummary:
      'No general municipal income tax. Business rates and local fees may apply separately.',
    socialSecuritySummary: 'National Insurance (Class 2/4 for self-employed; Class 1 for employees).',
    defaultMunicipalTaxRate: 0,
    disclaimer:
      'Estimates only for UK sole traders / small hospitality businesses. Confirm VAT registration thresholds and NI with HMRC or an accountant.',
  },
  FR: {
    countryCode: 'FR',
    countryName: 'France',
    currencyHint: 'EUR (€)',
    standardVatPercent: 20,
    reducedVatPercent: 10,
    vatLabel: 'TVA',
    incomeTaxSummary: 'Progressive IRPP brackets. Micro-enterprise / auto-entrepreneur regimes may use flat rates.',
    municipalTaxSummary: 'CFE and other local business taxes may apply depending on commune.',
    socialSecuritySummary: 'URSSAF social contributions (rate depends on regime).',
    defaultMunicipalTaxRate: 0,
    disclaimer:
      'Estimates only. Confirm TVA rates for food & drink and your régime with a French accountant (expert-comptable).',
  },
  DE: {
    countryCode: 'DE',
    countryName: 'Germany',
    currencyHint: 'EUR (€)',
    standardVatPercent: 19,
    reducedVatPercent: 7,
    vatLabel: 'MwSt / USt',
    incomeTaxSummary: 'Progressive Einkommensteuer with solidarity surcharge where applicable.',
    municipalTaxSummary: 'Trade tax (Gewerbesteuer) varies by municipality (Hebesatz).',
    socialSecuritySummary: 'Statutory social insurance or voluntary schemes depending on status.',
    defaultMunicipalTaxRate: 14,
    disclaimer:
      'Estimates only. Confirm reduced rates for catering and Gewerbesteuer with a Steuerberater.',
  },
  BE: {
    countryCode: 'BE',
    countryName: 'Belgium',
    currencyHint: 'EUR (€)',
    standardVatPercent: 12,
    reducedVatPercent: 6,
    vatLabel: 'BTW / TVA / MwSt',
    incomeTaxSummary: 'Progressive personal income tax with tax-free allowance.',
    municipalTaxSummary: 'Municipal tax is a percentage of income tax (commune rate, often ~6–9%).',
    socialSecuritySummary: 'Quarterly social contributions to your social insurance fund.',
    defaultMunicipalTaxRate: 7,
    disclaimer:
      'Estimates for Belgian self-employed sole traders. Confirm via MyMinfin and a certified accountant (boekhouder / comptable).',
  },
  ES: {
    countryCode: 'ES',
    countryName: 'Spain',
    currencyHint: 'EUR (€)',
    standardVatPercent: 10,
    reducedVatPercent: 4,
    vatLabel: 'IVA',
    incomeTaxSummary: 'IRPF progressive bands; autónomos may use modules or direct estimation.',
    municipalTaxSummary: 'IAE and other local taxes may apply depending on activity and municipality.',
    socialSecuritySummary: 'Seguridad Social cuota de autónomos (flat / income-based reforms apply).',
    defaultMunicipalTaxRate: 0,
    disclaimer:
      'Estimates only. Confirm IVA for hospitality and autónomo obligations with a gestor / asesor fiscal.',
  },
};

export const getRegionalTaxProfile = (
  countryCode: string | undefined | null,
): RegionalTaxProfile => {
  if (isSupportedCountry(countryCode)) {
    return PROFILES[countryCode];
  }
  return PROFILES.BE;
};

export const regionalTaxLines = (profile: RegionalTaxProfile): string[] => [
  `${profile.vatLabel}: standard ${profile.standardVatPercent}%` +
    (profile.reducedVatPercent != null
      ? ` (reduced often ${profile.reducedVatPercent}% for some food/drink)`
      : ''),
  `Income tax: ${profile.incomeTaxSummary}`,
  `Local / municipal: ${profile.municipalTaxSummary}`,
  `Social security: ${profile.socialSecuritySummary}`,
];
