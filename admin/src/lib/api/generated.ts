/**
 * Generated from the Rolewire FastAPI OpenAPI schema. Do not edit by hand.
 * Regenerate with: pnpm gen:api
 */
export interface paths {
    "/v1/public/jobs": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List published jobs */
        get: operations["list_jobs_v1_public_jobs_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/public/jobs/{job_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Job post with its questions */
        get: operations["get_job_v1_public_jobs__job_id__get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/public/jobs/{job_id}/upload-ticket": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Request a direct-to-storage upload ticket for a file question */
        post: operations["create_upload_ticket_v1_public_jobs__job_id__upload_ticket_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/public/jobs/{job_id}/uploads": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Server-relayed upload (Telegram targets, which have no presigned URLs) */
        post: operations["relay_upload_v1_public_jobs__job_id__uploads_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/public/jobs/{job_id}/apply": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Submit an application */
        post: operations["apply_v1_public_jobs__job_id__apply_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin/auth/signup": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Signup */
        post: operations["signup_v1_admin_auth_signup_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin/auth/login": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Login */
        post: operations["login_v1_admin_auth_login_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin/auth/refresh": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Refresh */
        post: operations["refresh_v1_admin_auth_refresh_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin/auth/me": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Me */
        get: operations["me_v1_admin_auth_me_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin/auth/oauth/{provider}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** Unlink Oauth */
        delete: operations["unlink_oauth_v1_admin_auth_oauth__provider__delete"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin/auth/oauth/{provider}/start": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Start
         * @description Begin a sign-in flow. Returns the consent URL, or 302s straight to it.
         */
        get: operations["start_v1_admin_auth_oauth__provider__start_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin/auth/oauth/{provider}/link": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Start Link
         * @description Begin a flow that links ``provider`` to the already-authenticated user.
         */
        post: operations["start_link_v1_admin_auth_oauth__provider__link_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin/auth/oauth/{provider}/callback": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Callback */
        get: operations["callback_v1_admin_auth_oauth__provider__callback_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin/jobs": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List Jobs */
        get: operations["list_jobs_v1_admin_jobs_get"];
        put?: never;
        /** Create Job */
        post: operations["create_job_v1_admin_jobs_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin/jobs/{job_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Job */
        get: operations["get_job_v1_admin_jobs__job_id__get"];
        put?: never;
        post?: never;
        /** Delete Job */
        delete: operations["delete_job_v1_admin_jobs__job_id__delete"];
        options?: never;
        head?: never;
        /** Update Job */
        patch: operations["update_job_v1_admin_jobs__job_id__patch"];
        trace?: never;
    };
    "/v1/admin/jobs/{job_id}/questions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Replace a job's question set */
        post: operations["replace_questions_v1_admin_jobs__job_id__questions_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin/applications": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List Applications */
        get: operations["list_applications_v1_admin_applications_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin/applications/{application_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Application */
        get: operations["get_application_v1_admin_applications__application_id__get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin/storage-configs": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List Storage Configs */
        get: operations["list_storage_configs_v1_admin_storage_configs_get"];
        put?: never;
        /** Create Storage Config */
        post: operations["create_storage_config_v1_admin_storage_configs_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin/storage-configs/{config_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** Delete Storage Config */
        delete: operations["delete_storage_config_v1_admin_storage_configs__config_id__delete"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin/billing": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Overview */
        get: operations["overview_v1_admin_billing_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin/billing/plans": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List Plans */
        get: operations["list_plans_v1_admin_billing_plans_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin/billing/upgrade": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Upgrade */
        post: operations["upgrade_v1_admin_billing_upgrade_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/webhooks/paddle": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Paddle Billing events */
        post: operations["paddle_webhook_v1_webhooks_paddle_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/webhooks/uddoktapay": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** UddoktaPay payment callback */
        post: operations["uddoktapay_webhook_v1_webhooks_uddoktapay_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/webhooks/brevo": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Brevo delivery events */
        post: operations["brevo_webhook_v1_webhooks_brevo_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/health": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Liveness probe */
        get: operations["health_health_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/health/ready": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Readiness probe (checks Redis) */
        get: operations["ready_health_ready_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        /** ApplicationAccepted */
        ApplicationAccepted: {
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /** Status */
            status: string;
            /**
             * Received At
             * Format: date-time
             */
            received_at: string;
        };
        /** ApplicationOut */
        ApplicationOut: {
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /**
             * Job Id
             * Format: uuid
             */
            job_id: string;
            /**
             * Tenant Id
             * Format: uuid
             */
            tenant_id: string;
            /** Answers */
            answers: {
                [key: string]: unknown;
            };
            /** Resume Ref */
            resume_ref: string | null;
            /** Applicant Email */
            applicant_email: string | null;
            /** Status */
            status: string;
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
        };
        /** ApplicationSubmit */
        ApplicationSubmit: {
            /** Answers */
            answers: {
                [key: string]: unknown;
            };
            /** Resume Ref */
            resume_ref?: string | null;
            /** Applicant Email */
            applicant_email?: string | null;
        };
        /** BillingOverview */
        BillingOverview: {
            /** Tenant Status */
            tenant_status: string;
            /** Region */
            region: string | null;
            /** Payment Provider */
            payment_provider: string | null;
            plan: components["schemas"]["PlanOut"] | null;
            subscription: components["schemas"]["SubscriptionOut"] | null;
            /** Invoices */
            invoices: components["schemas"]["InvoiceOut"][];
            /** Usage */
            usage: {
                [key: string]: string;
            };
        };
        /** Body_relay_upload_v1_public_jobs__job_id__uploads_post */
        Body_relay_upload_v1_public_jobs__job_id__uploads_post: {
            /** Field Key */
            field_key: string;
            /** File */
            file: string;
        };
        /** HTTPValidationError */
        HTTPValidationError: {
            /** Detail */
            detail?: components["schemas"]["ValidationError"][];
        };
        /** InvoiceOut */
        InvoiceOut: {
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /** Provider */
            provider: string;
            /** Provider Invoice Id */
            provider_invoice_id: string | null;
            /** Amount */
            amount: string;
            /** Currency */
            currency: string;
            /** Status */
            status: string;
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
        };
        /** JobCreate */
        JobCreate: {
            /** Title */
            title: string;
            /** Description */
            description?: string | null;
            /** Location */
            location?: string | null;
            /** Employment Type */
            employment_type?: string | null;
            /** Department */
            department?: string | null;
            /**
             * Status
             * @default draft
             * @enum {string}
             */
            status: "draft" | "published" | "closed";
            /**
             * Storage Target
             * @default hosted
             * @enum {string}
             */
            storage_target: "hosted" | "s3" | "gdrive" | "telegram";
            /** Storage Config Id */
            storage_config_id?: string | null;
            /** Ats Webhook Url */
            ats_webhook_url?: string | null;
            /**
             * Opencats Sync
             * @default false
             */
            opencats_sync: boolean;
            /** Questions */
            questions?: components["schemas"]["JobQuestionIn"][];
        };
        /** JobOut */
        JobOut: {
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /**
             * Tenant Id
             * Format: uuid
             */
            tenant_id: string;
            /** Title */
            title: string;
            /** Description */
            description: string | null;
            /** Location */
            location: string | null;
            /** Employment Type */
            employment_type: string | null;
            /** Department */
            department: string | null;
            /**
             * Status
             * @enum {string}
             */
            status: "draft" | "published" | "closed";
            /**
             * Storage Target
             * @enum {string}
             */
            storage_target: "hosted" | "s3" | "gdrive" | "telegram";
            /** Storage Config Id */
            storage_config_id: string | null;
            /** Ats Webhook Url */
            ats_webhook_url: string | null;
            /** Opencats Sync */
            opencats_sync: boolean;
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
            /**
             * Updated At
             * Format: date-time
             */
            updated_at: string;
            /**
             * Questions
             * @default []
             */
            questions: components["schemas"]["JobQuestionOut"][];
        };
        /** JobQuestionIn */
        JobQuestionIn: {
            /** Label */
            label: string;
            /** Field Key */
            field_key: string;
            /**
             * Question Type
             * @enum {string}
             */
            question_type: "text" | "textarea" | "select" | "multiselect" | "file" | "boolean" | "number" | "email" | "phone";
            /** Options */
            options?: string[] | null;
            /**
             * Required
             * @default true
             */
            required: boolean;
            /**
             * Sort Order
             * @default 0
             */
            sort_order: number;
        };
        /** JobQuestionOut */
        JobQuestionOut: {
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /** Label */
            label: string;
            /** Field Key */
            field_key: string;
            /**
             * Question Type
             * @enum {string}
             */
            question_type: "text" | "textarea" | "select" | "multiselect" | "file" | "boolean" | "number" | "email" | "phone";
            /** Options */
            options: string[] | null;
            /** Required */
            required: boolean;
            /** Sort Order */
            sort_order: number;
        };
        /** JobQuestionsReplace */
        JobQuestionsReplace: {
            /** Questions */
            questions: components["schemas"]["JobQuestionIn"][];
        };
        /** JobUpdate */
        JobUpdate: {
            /** Title */
            title?: string | null;
            /** Description */
            description?: string | null;
            /** Location */
            location?: string | null;
            /** Employment Type */
            employment_type?: string | null;
            /** Department */
            department?: string | null;
            /** Status */
            status?: ("draft" | "published" | "closed") | null;
            /** Storage Target */
            storage_target?: ("hosted" | "s3" | "gdrive" | "telegram") | null;
            /** Storage Config Id */
            storage_config_id?: string | null;
            /** Ats Webhook Url */
            ats_webhook_url?: string | null;
            /** Opencats Sync */
            opencats_sync?: boolean | null;
        };
        /** LoginRequest */
        LoginRequest: {
            /**
             * Email
             * Format: email
             */
            email: string;
            /** Password */
            password: string;
        };
        /** OAuthStartOut */
        OAuthStartOut: {
            /** Authorization Url */
            authorization_url: string;
            /** State */
            state: string;
        };
        /** Page[ApplicationOut] */
        Page_ApplicationOut_: {
            /** Items */
            items: components["schemas"]["ApplicationOut"][];
            /** Total */
            total: number;
            /** Limit */
            limit: number;
            /** Offset */
            offset: number;
        };
        /** Page[JobOut] */
        Page_JobOut_: {
            /** Items */
            items: components["schemas"]["JobOut"][];
            /** Total */
            total: number;
            /** Limit */
            limit: number;
            /** Offset */
            offset: number;
        };
        /** PlanOut */
        PlanOut: {
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /** Name */
            name: string;
            /** Monthly Price Usd */
            monthly_price_usd: string | null;
            /** Yearly Price Usd */
            yearly_price_usd: string | null;
            /** Monthly Price Bdt */
            monthly_price_bdt: string | null;
            /** Yearly Price Bdt */
            yearly_price_bdt: string | null;
            /** Features */
            features: {
                [key: string]: unknown;
            };
        };
        /** PublicJob */
        PublicJob: {
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /** Title */
            title: string;
            /** Location */
            location: string | null;
            /** Employment Type */
            employment_type: string | null;
            /** Department */
            department: string | null;
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
            /** Description */
            description: string | null;
            /** Company */
            company: string;
            /** Questions */
            questions: components["schemas"]["PublicQuestion"][];
        };
        /** PublicJobList */
        PublicJobList: {
            /** Items */
            items: components["schemas"]["PublicJobSummary"][];
            /** Total */
            total: number;
        };
        /** PublicJobSummary */
        PublicJobSummary: {
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /** Title */
            title: string;
            /** Location */
            location: string | null;
            /** Employment Type */
            employment_type: string | null;
            /** Department */
            department: string | null;
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
        };
        /** PublicQuestion */
        PublicQuestion: {
            /** Field Key */
            field_key: string;
            /** Label */
            label: string;
            /**
             * Type
             * @enum {string}
             */
            type: "text" | "textarea" | "select" | "multiselect" | "file" | "boolean" | "number" | "email" | "phone";
            /** Options */
            options?: string[] | null;
            /** Required */
            required: boolean;
        };
        /** RefreshRequest */
        RefreshRequest: {
            /** Refresh Token */
            refresh_token: string;
        };
        /** SignupRequest */
        SignupRequest: {
            /**
             * Email
             * Format: email
             */
            email: string;
            /** Password */
            password: string;
            /** Company Name */
            company_name: string;
            /** Slug */
            slug?: string | null;
        };
        /** StorageConfigCreate */
        StorageConfigCreate: {
            /** Name */
            name: string;
            /**
             * Type
             * @enum {string}
             */
            type: "s3" | "gdrive" | "telegram";
            /** Credentials */
            credentials: {
                [key: string]: string;
            };
            /** Config */
            config?: {
                [key: string]: unknown;
            };
        };
        /**
         * StorageConfigOut
         * @description Credentials are never echoed back — only the non-secret config envelope.
         */
        StorageConfigOut: {
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /**
             * Tenant Id
             * Format: uuid
             */
            tenant_id: string;
            /** Name */
            name: string;
            /**
             * Type
             * @enum {string}
             */
            type: "s3" | "gdrive" | "telegram";
            /** Config */
            config: {
                [key: string]: unknown;
            };
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
        };
        /** SubscriptionOut */
        SubscriptionOut: {
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /**
             * Plan Id
             * Format: uuid
             */
            plan_id: string;
            /** Provider */
            provider: string;
            /** Billing Cycle */
            billing_cycle: string;
            /** Status */
            status: string;
            /** Current Period End */
            current_period_end: string | null;
        };
        /** TokenPair */
        TokenPair: {
            /** Access Token */
            access_token: string;
            /** Refresh Token */
            refresh_token: string;
            /**
             * Token Type
             * @default bearer
             */
            token_type: string;
            /** Expires In */
            expires_in: number;
        };
        /** UpgradeCheckout */
        UpgradeCheckout: {
            /** Provider */
            provider: string;
            /** Checkout Url */
            checkout_url: string | null;
            /**
             * Plan Id
             * Format: uuid
             */
            plan_id: string;
            /** Billing Cycle */
            billing_cycle: string;
            /** Note */
            note?: string | null;
        };
        /** UpgradeRequest */
        UpgradeRequest: {
            /**
             * Plan Id
             * Format: uuid
             */
            plan_id: string;
            /**
             * Billing Cycle
             * @enum {string}
             */
            billing_cycle: "monthly" | "yearly";
            /**
             * Provider
             * @enum {string}
             */
            provider: "paddle" | "uddoktapay";
        };
        /** UploadTicket */
        UploadTicket: {
            /**
             * Mode
             * @enum {string}
             */
            mode: "presigned" | "server_relay";
            /** Upload Url */
            upload_url?: string | null;
            /** Fields */
            fields?: {
                [key: string]: string;
            };
            /** Resume Ref */
            resume_ref: string;
            /** Expires In */
            expires_in: number;
            /** Max Bytes */
            max_bytes: number;
        };
        /** UploadTicketRequest */
        UploadTicketRequest: {
            /** Field Key */
            field_key: string;
            /** Filename */
            filename: string;
            /** Content Type */
            content_type: string;
            /** Size Bytes */
            size_bytes: number;
        };
        /** UserOut */
        UserOut: {
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /**
             * Tenant Id
             * Format: uuid
             */
            tenant_id: string;
            /**
             * Email
             * Format: email
             */
            email: string;
            /** Email Verified */
            email_verified: boolean;
            /** Email Deliverable */
            email_deliverable: boolean;
            /** Avatar Url */
            avatar_url: string | null;
            /** Role */
            role: string;
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
            /**
             * Has Password
             * @default false
             */
            has_password: boolean;
            /**
             * Oauth Providers
             * @default []
             */
            oauth_providers: string[];
        };
        /** ValidationError */
        ValidationError: {
            /** Location */
            loc: (string | number)[];
            /** Message */
            msg: string;
            /** Error Type */
            type: string;
            /** Input */
            input?: unknown;
            /** Context */
            ctx?: Record<string, never>;
        };
    };
    responses: never;
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    list_jobs_v1_public_jobs_get: {
        parameters: {
            query?: {
                slug?: string | null;
                limit?: number;
                offset?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PublicJobList"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_job_v1_public_jobs__job_id__get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                job_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PublicJob"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    create_upload_ticket_v1_public_jobs__job_id__upload_ticket_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                job_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UploadTicketRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UploadTicket"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    relay_upload_v1_public_jobs__job_id__uploads_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                job_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "multipart/form-data": components["schemas"]["Body_relay_upload_v1_public_jobs__job_id__uploads_post"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: string;
                    };
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    apply_v1_public_jobs__job_id__apply_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                job_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ApplicationSubmit"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplicationAccepted"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    signup_v1_admin_auth_signup_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SignupRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TokenPair"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    login_v1_admin_auth_login_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["LoginRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TokenPair"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    refresh_v1_admin_auth_refresh_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["RefreshRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TokenPair"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    me_v1_admin_auth_me_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UserOut"];
                };
            };
        };
    };
    unlink_oauth_v1_admin_auth_oauth__provider__delete: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                provider: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    start_v1_admin_auth_oauth__provider__start_get: {
        parameters: {
            query?: {
                redirect?: boolean;
            };
            header?: never;
            path: {
                provider: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OAuthStartOut"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    start_link_v1_admin_auth_oauth__provider__link_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                provider: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OAuthStartOut"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    callback_v1_admin_auth_oauth__provider__callback_get: {
        parameters: {
            query: {
                code: string;
                state: string;
            };
            header?: never;
            path: {
                provider: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TokenPair"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    list_jobs_v1_admin_jobs_get: {
        parameters: {
            query?: {
                status?: string | null;
                limit?: number;
                offset?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Page_JobOut_"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    create_job_v1_admin_jobs_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["JobCreate"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JobOut"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_job_v1_admin_jobs__job_id__get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                job_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JobOut"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    delete_job_v1_admin_jobs__job_id__delete: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                job_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    update_job_v1_admin_jobs__job_id__patch: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                job_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["JobUpdate"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JobOut"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    replace_questions_v1_admin_jobs__job_id__questions_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                job_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["JobQuestionsReplace"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JobQuestionOut"][];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    list_applications_v1_admin_applications_get: {
        parameters: {
            query?: {
                job_id?: string | null;
                limit?: number;
                offset?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Page_ApplicationOut_"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_application_v1_admin_applications__application_id__get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                application_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApplicationOut"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    list_storage_configs_v1_admin_storage_configs_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["StorageConfigOut"][];
                };
            };
        };
    };
    create_storage_config_v1_admin_storage_configs_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["StorageConfigCreate"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["StorageConfigOut"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    delete_storage_config_v1_admin_storage_configs__config_id__delete: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                config_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    overview_v1_admin_billing_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BillingOverview"];
                };
            };
        };
    };
    list_plans_v1_admin_billing_plans_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PlanOut"][];
                };
            };
        };
    };
    upgrade_v1_admin_billing_upgrade_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpgradeRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UpgradeCheckout"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    paddle_webhook_v1_webhooks_paddle_post: {
        parameters: {
            query?: never;
            header?: {
                "Paddle-Signature"?: string | null;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: string;
                    };
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    uddoktapay_webhook_v1_webhooks_uddoktapay_post: {
        parameters: {
            query?: never;
            header?: {
                "RT-UDDOKTAPAY-API-KEY"?: string | null;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: string;
                    };
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    brevo_webhook_v1_webhooks_brevo_post: {
        parameters: {
            query?: never;
            header?: {
                "X-Brevo-Webhook-Token"?: string | null;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: number;
                    };
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    health_health_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: unknown;
                    };
                };
            };
        };
    };
    ready_health_ready_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: unknown;
                    };
                };
            };
        };
    };
}
