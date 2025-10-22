# Requirements Document

## Introduction

武器のスキル説明テキストから属性情報を自動抽出し、武器データに統合する機能を開発する。現在の武器データでは、スキル説明（equipmentSkillDesc）に「炎属性ダメージ」「氷属性ダメージ」「電気属性ダメージ」「物理属性ダメージ」「エーテル属性ダメージ」などの属性情報が含まれているが、これらが構造化されたデータとして抽出されていない。

## Glossary

- **Weapon_System**: 武器データ処理システム
- **Skill_Description**: 武器のスキル説明テキスト（equipmentSkillDesc）
- **Attribute_Pattern**: 属性を示すテキストパターン（例：「炎属性ダメージ」）
- **Extracted_Attributes**: スキル説明から抽出された属性のリスト
- **Weapon_Data**: 武器の全データ構造
- **Attribute_Mapping**: 日本語属性名から英語属性名への変換マッピング

## Requirements

### Requirement 1

**User Story:** As a developer, I want to extract weapon attributes from skill descriptions, so that I can have structured attribute data for each weapon.

#### Acceptance Criteria

1. WHEN Weapon_System processes a Skill_Description, THE Weapon_System SHALL identify all Attribute_Pattern occurrences in the text
2. WHEN an Attribute_Pattern is found, THE Weapon_System SHALL extract the attribute name using predefined patterns
3. THE Weapon_System SHALL convert Japanese attribute names to English using Attribute_Mapping
4. THE Weapon_System SHALL return Extracted_Attributes as an array of standardized attribute strings
5. WHERE multiple instances of the same attribute exist, THE Weapon_System SHALL include the attribute only once in the result

### Requirement 2

**User Story:** As a developer, I want to integrate extracted attributes into weapon data, so that each weapon has complete attribute information.

#### Acceptance Criteria

1. THE Weapon_System SHALL add an "extractedAttributes" field to each Weapon_Data object
2. WHEN processing Weapon_Data, THE Weapon_System SHALL populate extractedAttributes with results from attribute extraction
3. THE Weapon_System SHALL preserve existing weapon data structure while adding the new field
4. THE Weapon_System SHALL handle weapons with no detectable attributes by setting extractedAttributes to an empty array
5. THE Weapon_System SHALL validate that all extracted attributes match the standard attribute set

### Requirement 3

**User Story:** As a developer, I want to validate extraction accuracy, so that I can ensure the system correctly identifies weapon attributes.

#### Acceptance Criteria

1. THE Weapon_System SHALL provide validation functions to verify extraction results
2. WHEN validation is performed, THE Weapon_System SHALL compare extracted attributes against expected patterns
3. THE Weapon_System SHALL report any weapons where extraction failed or produced unexpected results
4. THE Weapon_System SHALL log detailed information about attribute extraction for debugging purposes
5. THE Weapon_System SHALL support manual verification of extraction results through comparison utilities

### Requirement 4

**User Story:** As a developer, I want to handle edge cases in attribute extraction, so that the system works reliably across all weapon descriptions.

#### Acceptance Criteria

1. WHEN Skill_Description contains no attribute information, THE Weapon_System SHALL return an empty Extracted_Attributes array
2. WHEN Skill_Description contains malformed or unclear attribute references, THE Weapon_System SHALL apply best-effort extraction with logging
3. THE Weapon_System SHALL handle both Japanese and English skill descriptions consistently
4. THE Weapon_System SHALL ignore non-attribute damage types that may appear in descriptions
5. WHERE attribute extraction encounters errors, THE Weapon_System SHALL continue processing other weapons without failure
