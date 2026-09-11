// Account form value shape + type-specific field projection — port of the web
// `AccountFormValues` / `toAccountTypeSpecificFields` / `accountToFormValues`
// (src/features/accounts/types/account-form.ts, docs/accounts.md §2.5).

import '../core/decimals.dart';
import 'account_models.dart';

const bankSubtypeCodes = ['debit', 'credit'];
const metalTypeCodes = ['gold', 'silver'];
const investmentTypeCodes = ['stock_etf', 'crypto', 'other'];
const propertyTypeCodes = ['apartment', 'villa', 'land', 'office', 'other'];
const businessTypeCodes = [
  'sole_proprietorship',
  'partnership',
  'llc',
  'private_company',
  'family_owned',
  'other',
];
const industryCodes = [
  'retail',
  'ecommerce',
  'food_beverage',
  'cosmetics_beauty',
  'healthcare',
  'technology',
  'real_estate',
  'construction',
  'manufacturing',
  'education',
  'professional_services',
  'financial_services',
  'logistics_transportation',
  'hospitality_tourism',
  'agriculture',
  'other',
];
const goldPurityCodes = ['24k', '22k', '21k', '18k', '14k', '10k', '9k'];
const silverPurityCodes = ['999', '958', '950', '925', '900', '835', '800'];

List<String> purityOptionsFor(String metalType) {
  if (metalType == 'gold') return [...goldPurityCodes, 'other'];
  if (metalType == 'silver') return [...silverPurityCodes, 'other'];
  return const [];
}

String humanLabel(String code) => code
    .split(RegExp(r'[_\s]+'))
    .where((w) => w.isNotEmpty)
    .map((w) => '${w[0].toUpperCase()}${w.substring(1)}')
    .join(' ');

// Display labels — 1:1 with the web i18n `accounts.form.*` strings so the mobile
// pickers read identically to the web `<select>` options.

const bankSubtypeLabels = {'debit': 'Debit', 'credit': 'Credit'};

const investmentTypeLabels = {
  'stock_etf': 'Stock & ETF',
  'crypto': 'Crypto',
  'other': 'Other',
};

const propertyTypeLabels = {
  'apartment': 'Apartment',
  'villa': 'Villa',
  'land': 'Land',
  'office': 'Office',
  'other': 'Other',
};

const businessTypeLabels = {
  'sole_proprietorship': 'Sole Proprietorship',
  'partnership': 'Partnership',
  'llc': 'Limited Liability Company (LLC)',
  'private_company': 'Private Company',
  'family_owned': 'Family-Owned Business',
  'other': 'Other',
};

const industryLabels = {
  'retail': 'Retail',
  'ecommerce': 'E-commerce',
  'food_beverage': 'Food & Beverage',
  'cosmetics_beauty': 'Cosmetics & Beauty',
  'healthcare': 'Healthcare',
  'technology': 'Technology',
  'real_estate': 'Real Estate',
  'construction': 'Construction',
  'manufacturing': 'Manufacturing',
  'education': 'Education',
  'professional_services': 'Professional Services',
  'financial_services': 'Financial Services',
  'logistics_transportation': 'Logistics & Transportation',
  'hospitality_tourism': 'Hospitality & Tourism',
  'agriculture': 'Agriculture',
  'other': 'Other',
};

const metalTypeLabels = {'gold': 'Gold', 'silver': 'Silver'};

const currencyLabels = {
  'USD': 'USD — US Dollar',
  'SAR': 'SAR — Saudi Riyal',
  'EGP': 'EGP — Egyptian Pound',
  'EUR': 'EUR — Euro',
  'GBP': 'GBP — British Pound',
};

/// Balance-field label by type (web `getBalanceLabelKey`).
String balanceLabelFor(AccountType type) => switch (type) {
  AccountType.brokerage => 'Starting cash balance',
  AccountType.realEstate || AccountType.business => 'Current value',
  _ => 'Current balance',
};

// ---- classification "other:<text>" encoding (businessType / industry) --------

const _otherPrefix = 'other:';

({String value, String custom}) parseClassification(
  String? stored,
  List<String> options,
) {
  if (stored == null || stored.isEmpty) return (value: '', custom: '');
  if (stored.startsWith(_otherPrefix)) {
    return (value: 'other', custom: stored.substring(_otherPrefix.length));
  }
  if (options.contains(stored)) return (value: stored, custom: '');
  return (value: 'other', custom: stored);
}

String? storeClassification(String value, String custom) {
  final v = value.trim();
  if (v.isEmpty) return null;
  if (v != 'other') return v;
  final c = custom.trim();
  return c.isEmpty ? null : '$_otherPrefix$c';
}

String classificationLabel(String? stored, List<String> options) {
  final parsed = parseClassification(stored, options);
  if (parsed.value == 'other') {
    return parsed.custom.isEmpty ? 'Other' : parsed.custom;
  }
  return parsed.value.isEmpty ? '—' : humanLabel(parsed.value);
}

// ---- form values -----------------------------------------------------------

class AccountFormValues {
  AccountFormValues({
    this.name = '',
    this.accountTypeCode = 'cash',
    this.currencyCode = 'USD',
    this.openingBalance = '0',
    this.bankSubtype = '',
    this.creditCardLimit = '',
    this.dueDayOfMonth = '',
    this.investmentType = '',
    this.balanceGrams = '0',
    this.propertyType = '',
    this.ownershipPercentage = '100',
    this.businessType = '',
    this.businessTypeOther = '',
    this.industry = '',
    this.industryOther = '',
    this.location = '',
    String? valuationDate,
    this.valuationMethod = '',
    this.valuationNotes = '',
    this.metalType = '',
    this.purity = '',
    this.purchaseDate = '',
    this.costPerUnit = '0',
    this.notes = '',
    this.isActive = true,
  }) : valuationDate = valuationDate ?? _today();

  String name;
  String accountTypeCode;
  String currencyCode;
  String openingBalance;
  String bankSubtype;
  String creditCardLimit;
  String dueDayOfMonth;
  String investmentType;
  String balanceGrams;
  String propertyType;
  String ownershipPercentage;
  String businessType;
  String businessTypeOther;
  String industry;
  String industryOther;
  String location;
  String valuationDate;
  String valuationMethod;
  String valuationNotes;
  String metalType;
  String purity;
  String purchaseDate;
  String costPerUnit;
  String notes;
  bool isActive;

  AccountType get type => AccountType.fromCode(accountTypeCode);

  static String _today() => DateTime.now().toIso8601String().substring(0, 10);

  static AccountFormValues fromAccount(Account a) {
    final bt = parseClassification(a.businessType, businessTypeCodes);
    final ind = parseClassification(a.industry, industryCodes);
    return AccountFormValues(
      name: a.name,
      accountTypeCode: a.type.code,
      currencyCode: a.currencyCode,
      openingBalance: a.openingBalance,
      bankSubtype: a.bankSubtype ?? '',
      creditCardLimit: a.creditCardLimit ?? '',
      dueDayOfMonth: a.dueDayOfMonth?.toString() ?? '',
      investmentType: a.investmentType ?? '',
      balanceGrams: a.balanceGrams ?? '0',
      propertyType: a.propertyType ?? '',
      ownershipPercentage: a.ownershipPercentage ?? '100',
      businessType: bt.value,
      businessTypeOther: bt.custom,
      industry: ind.value,
      industryOther: ind.custom,
      location: a.location ?? '',
      valuationDate: '',
      metalType: a.metalType ?? '',
      purity: a.purity ?? '',
      purchaseDate: a.purchaseDate ?? '',
      costPerUnit: a.costPerUnit ?? '0',
      notes: a.notes ?? '',
      isActive: a.isActive,
    );
  }
}

/// Available credit for a Bank Credit account is `limit - currentBalance`
/// (web `getCreditCardAmountDue`).
String? creditCardAmountDue(String limit, String currentBalance) =>
    D.subtract(limit.trim(), currentBalance.trim());

/// The camelCase payload columns for `createAccount` / `updateAccount`. Mirrors
/// the web `toAccountTypeSpecificFields`: irrelevant fields are nulled per type,
/// gold's `openingBalance` is forced to "0".
class AccountTypeSpecificFields {
  String? openingBalance;
  String? bankSubtype;
  String? creditCardLimit;
  int? dueDayOfMonth;
  String? investmentType;
  String? balanceGrams;
  String? propertyType;
  String? ownershipPercentage;
  String? businessType;
  String? industry;
  String? location;
  String? metalType;
  String? purity;
  String? purchaseDate;
  String? costPerUnit;

  Map<String, dynamic> toColumns({required String name, String? currencyCode}) {
    final map = <String, dynamic>{
      'name': name,
      'bank_subtype': bankSubtype,
      'credit_card_limit': creditCardLimit,
      'due_day_of_month': dueDayOfMonth,
      'investment_type': investmentType,
      'balance_grams': balanceGrams,
      'property_type': propertyType,
      'ownership_percentage': ownershipPercentage,
      'business_type': businessType,
      'industry': industry,
      'location': location,
      'metal_type': metalType,
      'purity': purity,
      'purchase_date': purchaseDate,
      'cost_per_unit': costPerUnit,
    };
    if (currencyCode != null) map['currency_code'] = currencyCode;
    if (openingBalance != null) map['opening_balance'] = openingBalance;
    return map;
  }
}

AccountTypeSpecificFields toAccountTypeSpecificFields(AccountFormValues v) {
  final f = AccountTypeSpecificFields();
  switch (v.type) {
    case AccountType.cash:
    case AccountType.other:
      f.openingBalance = v.openingBalance.trim();
    case AccountType.bank:
      f.openingBalance = v.openingBalance.trim();
      f.bankSubtype = v.bankSubtype.isEmpty ? null : v.bankSubtype;
      if (v.bankSubtype == 'credit') {
        f.creditCardLimit = v.creditCardLimit.trim().isEmpty
            ? null
            : v.creditCardLimit.trim();
        f.dueDayOfMonth = v.dueDayOfMonth.isEmpty
            ? null
            : int.tryParse(v.dueDayOfMonth);
      }
    case AccountType.brokerage:
      f.openingBalance = v.openingBalance.trim();
      f.investmentType = v.investmentType.isEmpty ? null : v.investmentType;
    case AccountType.gold:
      f.openingBalance = '0';
      f.metalType = v.metalType.isEmpty ? null : v.metalType;
    case AccountType.realEstate:
      f.openingBalance = '0';
      f.propertyType = v.propertyType.isEmpty ? null : v.propertyType;
      f.ownershipPercentage = v.ownershipPercentage.trim();
      f.location = v.location.trim().isEmpty ? null : v.location.trim();
    case AccountType.business:
      f.openingBalance = '0';
      f.businessType = storeClassification(v.businessType, v.businessTypeOther);
      f.industry = storeClassification(v.industry, v.industryOther);
      f.ownershipPercentage = v.ownershipPercentage.trim();
  }
  return f;
}
