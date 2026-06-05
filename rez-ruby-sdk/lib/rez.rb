require 'net/http'
require 'json'
require 'uri'

module REZ
  VERSION = '1.0.0'.freeze

  # Error classes
  class REZError < StandardError
    attr_reader :message, :status_code, :details

    def initialize(message, status_code: nil, details: {})
      super(message)
      @message = message
      @status_code = status_code
      @details = details
    end
  end

  class RateLimitError < REZError; end
  class AuthenticationError < REZError; end
  class NotFoundError < REZError; end
  class ValidationError < REZError; end

  # Client class
  class Client
    attr_reader :base_url, :api_key, :timeout, :max_retries

    def initialize(base_url: 'http://localhost:8080', api_key: nil, timeout: 30, max_retries: 3)
      @base_url = base_url.chomp('/')
      @api_key = api_key
      @timeout = timeout
      @max_retries = max_retries
    end

    # HTTP methods
    def get(path, params: {})
      uri = URI("#{base_url}#{path}")
      uri.query = URI.encode_www_form(params) unless params.empty?
      request(:get, uri)
    end

    def post(path, body: nil)
      uri = URI("#{base_url}#{path}")
      request(:post, uri, body)
    end

    def put(path, body: nil)
      uri = URI("#{base_url}#{path}")
      request(:put, uri, body)
    end

    def delete(path)
      uri = URI("#{base_url}#{path}")
      request(:delete, uri)
    end

    # Service accessors
    def agents
      @agents ||= AgentService.new(self)
    end

    def automl
      @automl ||= AutoMLService.new(self)
    end

    def invoice
      @invoice ||= InvoiceService.new(self)
    end

    def contracts
      @contracts ||= ContractsService.new(self)
    end

    def legal
      @legal ||= LegalService.new(self)
    end

    def twin
      @twin ||= TwinService.new(self)
    end

    def ranking
      @ranking ||= RankingService.new(self)
    end

    def graphql
      @graphql ||= GraphQLService.new(self)
    end

    # Health check all services
    def health_check_all
      services = %w[agents automl invoice contracts legal twin ranking graphql]
      results = {}
      services.each do |service|
        begin
          results[service] = send(service).health_check
        rescue REZError => e
          results[service] = { status: 'down', error: e.message }
        end
      end
      results
    end

    private

    def request(method, uri, body = nil)
      http = Net::HTTP.new(uri.host, uri.port)
      http.open_timeout = timeout
      http.read_timeout = timeout

      case method
      when :get
        req = Net::HTTP::Get.new(uri)
      when :post
        req = Net::HTTP::Post.new(uri)
        req.body = body.to_json if body
      when :put
        req = Net::HTTP::Put.new(uri)
        req.body = body.to_json if body
      when :delete
        req = Net::HTTP::Delete.new(uri)
      end

      req['Content-Type'] = 'application/json'
      req['User-Agent'] = "rez-ruby-sdk/#{VERSION}"
      req['X-API-Key'] = api_key if api_key

      execute_with_retry(http, req)
    end

    def execute_with_retry(http, req)
      last_error = nil

      (max_retries + 1).times do |attempt|
        begin
          response = http.request(req)
          handle_response(response)
        rescue *retryable_exceptions => e
          last_error = e
          sleep(2**attempt) if attempt < max_retries
          next
        end
      end

      raise last_error if last_error
    end

    def retryable_exceptions
      [Errno::ECONNRESET, Errno::ECONNREFUSED, Net::OpenTimeout, Net::ReadTimeout]
    end

    def handle_response(response)
      status_code = response.code.to_i
      body = JSON.parse(response.body) rescue {}

      case status_code
      when 200..299
        body
      when 401
        raise AuthenticationError.new(
          body.dig('error', 'message') || 'Authentication failed',
          status_code: status_code, details: body
        )
      when 404
        raise NotFoundError.new(
          body.dig('error', 'message') || 'Not found',
          status_code: status_code, details: body
        )
      when 422
        raise ValidationError.new(
          body.dig('error', 'message') || 'Validation failed',
          status_code: status_code, details: body
        )
      when 429
        raise RateLimitError.new(
          body.dig('error', 'message') || 'Rate limited',
          status_code: status_code, details: body
        )
      else
        raise REZError.new(
          body.dig('error', 'message') || "HTTP #{status_code}",
          status_code: status_code, details: body
        )
      end
    end
  end

  # Service modules
  module AgentService
    def self.new(client)
      Module.new do
        include AgentService
        define_singleton_method(:client) { client }
      end
    end

    module AgentService
      def list(skip: 0, limit: 20)
        client.get('/api/agents', params: { skip: skip, limit: limit })
      end

      def get(agent_id)
        client.get("/api/agents/#{agent_id}")
      end

      def create(params)
        client.post('/api/agents', body: params)
      end

      def update(agent_id, params)
        client.put("/api/agents/#{agent_id}", body: params)
      end

      def delete(agent_id)
        client.delete("/api/agents/#{agent_id}")
      end

      def health_check
        client.get('/health')
      end
    end
  end

  module AutoMLService
    def self.new(client)
      Module.new do
        include AutoMLService
        define_singleton_method(:client) { client }
      end
    end

    module AutoMLService
      def list_models(skip: 0, limit: 20)
        client.get('/api/automl/models', params: { skip: skip, limit: limit })
      end

      def get_model(model_id)
        client.get("/api/automl/models/#{model_id}")
      end

      def train(params)
        client.post('/api/automl/train', body: params)
      end

      def predict(model_id, features)
        client.post("/api/automl/predict/#{model_id}", body: { features: features })
      end

      def delete_model(model_id)
        client.delete("/api/automl/models/#{model_id}")
      end
    end
  end

  module InvoiceService
    def self.new(client)
      Module.new do
        include InvoiceService
        define_singleton_method(:client) { client }
      end
    end

    module InvoiceService
      def create(params)
        client.post('/api/invoice/create', body: params)
      end

      def get(invoice_id)
        client.get("/api/invoice/#{invoice_id}")
      end

      def list(skip: 0, limit: 20, status: nil)
        params = { skip: skip, limit: limit }
        params[:status] = status if status
        client.get('/api/invoice/list', params: params)
      end

      def validate(invoice_id)
        client.post("/api/invoice/validate/#{invoice_id}")
      end
    end
  end

  module ContractsService
    def self.new(client)
      Module.new do
        include ContractsService
        define_singleton_method(:client) { client }
      end
    end

    module ContractsService
      def generate(params)
        client.post('/api/contracts/generate', body: params)
      end

      def get(contract_id)
        client.get("/api/contracts/#{contract_id}")
      end

      def analyze(contract_id)
        client.post("/api/contracts/analyze/#{contract_id}")
      end
    end
  end

  module LegalService
    def self.new(client)
      Module.new do
        include LegalService
        define_singleton_method(:client) { client }
      end
    end

    module LegalService
      def research(query, jurisdiction: nil)
        params = { query: query }
        params[:jurisdiction] = jurisdiction if jurisdiction
        client.get('/api/legal/research', params: params)
      end

      def analyze_document(document_text)
        client.post('/api/legal/analyze', body: { document_text: document_text })
      end

      def check_compliance(requirements, context: {})
        client.post('/api/legal/compliance', body: { requirements: requirements, context: context })
      end
    end
  end

  module TwinService
    def self.new(client)
      Module.new do
        include TwinService
        define_singleton_method(:client) { client }
      end
    end

    module TwinService
      def create(params)
        client.post('/api/twin/create', body: params)
      end

      def get(twin_id)
        client.get("/api/twin/#{twin_id}")
      end

      def get_state(twin_id)
        client.get("/api/twin/#{twin_id}/state")
      end

      def update_state(twin_id, state)
        client.post("/api/twin/#{twin_id}/state", body: { state: state })
      end

      def sync(twin_id)
        client.post("/api/twin/#{twin_id}/sync")
      end
    end
  end

  module RankingService
    def self.new(client)
      Module.new do
        include RankingService
        define_singleton_method(:client) { client }
      end
    end

    module RankingService
      def score(params)
        client.post('/api/ranking/score', body: params)
      end

      def top_k(entities, k: 10, algorithm: 'weighted')
        client.post('/api/ranking/top-k', body: { entities: entities, k: k, algorithm: algorithm })
      end
    end
  end

  module GraphQLService
    def self.new(client)
      Module.new do
        include GraphQLService
        define_singleton_method(:client) { client }
      end
    end

    module GraphQLService
      def execute(query, variables: nil)
        body = { query: query }
        body[:variables] = variables if variables
        client.post('/graphql', body: body)
      end
    end
  end
end